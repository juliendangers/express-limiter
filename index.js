module.exports = function (app, db) {
  var defaultKeyGen = function (req, path, method, lookup) {
    return 'ratelimit:' + path + ':' + method + ':' + lookup.map(function (item) {
        return item + ':' + item.split('.').reduce(function (prev, cur) {
            return prev[cur];
          }, req);
      }).join(':');
  };
  return function (opts) {
    var middleware = function (req, res, next) {
      if (opts.whitelist && opts.whitelist(req)) {
        return next();
      }
      opts.lookup = Array.isArray(opts.lookup) ? opts.lookup : [opts.lookup];
      opts.onRateLimited = typeof opts.onRateLimited === 'function' ? opts.onRateLimited : function (req, res, next) {
        res.status(429).send('Rate limit exceeded');
      };
      opts.keyGenerator = typeof opts.keyGenerator === 'function' ? opts.keyGenerator : function(req) {
        return defaultKeyGen(req, opts.path || req.path, (opts.method || req.method).toLowerCase(), opts.lookup);
      };
      var key = opts.keyGenerator(req);
      db.get(key, function (err, limit) {
        if (err && opts.ignoreErrors) {
          return next();
        }
        var now = Date.now();
        limit = limit ? JSON.parse(limit) : {
          total: opts.total,
          remaining: opts.total,
          reset: now + opts.expire
        };

        if (now > limit.reset) {
          limit.reset = now + opts.expire;
          limit.remaining = opts.total;
        }

        // do not allow negative remaining
        limit.remaining = Math.max(Number(limit.remaining) - 1, -1);
        db.set(key, JSON.stringify(limit), 'PX', opts.expire, function () {
          if (!opts.skipHeaders) {
            res.set('X-RateLimit-Limit', limit.total);
            res.set('X-RateLimit-Remaining', Math.max(limit.remaining, 0));
            res.set('X-RateLimit-Reset', Math.ceil(limit.reset / 1000)); // UTC epoch seconds
          }

          if (limit.remaining >= 0) {
            return next();
          }

          var after = (limit.reset - Date.now()) / 1000;

          if (!opts.skipHeaders) {
            res.set('Retry-After', after);
          }

          opts.onRateLimited(req, res, next);
        });

      });
    };
    if (opts.method && opts.path) {
      app[opts.method](opts.path, middleware);
    }
    return middleware;
  };
};
