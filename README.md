## Express rate-limiter2
Rate limiting middleware for Express applications built on redis

Based on ded/express-limiter (https://github.com/ded/express-limiter)


``` sh
npm install express-limiter2 --save
```

``` js
var express = require('express')
var app = express()
var client = require('redis').createClient()

var limiter = require('express-limiter2')(client, app)

/**
 * you may also pass it an Express 4.0 `Router`
 *
 * router = express.Router()
 * limiter = require('express-limiter')(client, router)
 */

limiter({
  path: '/api/action',
  method: 'get',
  lookup: function(req) {
    return [req.connection.remoteAddress];
  },
  // 150 requests per hour
  total: 150,
  expire: 1000 * 60 * 60
})

app.get('/api/action', function (req, res) {
  res.send(200, 'ok')
})
```

### API options

``` js
limiter(options)
```

 - `path`: `String` *optional* route path to the request
 - `method`: `String` *optional* http method. accepts `get`, `post`, `put`, `delete`, and of course Express' `all`
 - `lookup`: `function(req)` must return a list of string used for redis key. It can be req param, or custom data. See [examples](#examples) for common usages (default lookup is performed on req.path, req.method and req.connection.remoteAddress)
 - `total`: `Number` allowed number of requests before getting rate limited
 - `expire`: `Number` amount of time in `ms` before the rate-limited is reset
 - `whitelist`: `function(req)` optional param allowing the ability to whitelist. return `boolean`, `true` to whitelist, `false` to passthru to limiter.
 - `skipHeaders`: `Boolean` whether to skip sending HTTP headers for rate limits ()
 - `ignoreErrors`: `Boolean` whether errors generated from redis should allow the middleware to call next().  Defaults to false.
 - `keyFormatter`: `function(params)` optional param to customize key generation for redis. You can specify you prefix, suffix, and the way you join key's parts (See code for default behaviour)
 - `onRateLimited`: `function(req, res, next)` optional param to define the behaviour of your choice when rate limit is reached

### Examples

``` js
// limit by IP address, path and method (default behaviour)
limiter({
  ...
  lookup: function(req) { return [req.path, req.method, req.connection.remoteAddress];}
  ...
})

// or if you are behind a trusted proxy (like nginx)
limiter({
  lookup: function(req) { return [req.path, req.method, req.headers.x-forwarded-for];}
})

// by user (assuming a user is logged in with a valid id)
limiter({
  lookup: function(req) { return [req.path, req.method, req.user.id]; }
})

// limit your entire app (quotas are applied on each route/method couple)
limiter({
  path: '*',
  method: 'all',
  lookup: function(req) {
    return [req.connection.remoteAddress, req.method, req.path];
  }
})

// rate limit your app globally by IP address (not each route/method couple)
limiter({
  path: '*',
  method: 'all',
  lookup: function(req) {
    return [req.connection.remoteAddress];
  }
})

// limit users on same IP
limiter({
  path: '*',
  method: 'all',
  lookup: function(req) {
    return [req.user.id, req.connection.remoteAddress];
  }
})

// whitelist user admins
limiter({
  path: '/delete/thing',
  method: 'post',
  lookup: function(req) {
    return [req.user.id, req.path, req.method]
  },
  whitelist: function (req) {
    return !!req.user.is_admin
  }
})

// skip sending HTTP limit headers
limiter({
  path: '/delete/thing',
  method: 'post',
  lookup: function(req) {
    return [req.user.id, req.path, req.method]
  },
  whitelist: function (req) {
    return !!req.user.is_admin
  },
  skipHeaders: true
})

// custom data
// in some case you may want to rate-limit not a specific route/method
// but several routes, or several methods, or whatever you want actually
// use the lookup function to adjust it to your needs
limiter({
  path: '/api/*',
  method: 'all',
  lookup: function(req) {
    return [req.user.id, req.connection.remoteAddress, 'api'];
  }
})

// custom redis keys
limiter({
  path: '/api/*',
  method: 'get',
  lookup: function(req) {
    return [req.user.id, req.path, req.method]
  },
  keyFormatter: function(params) {
    return 'myRateLimit:' + params.join("-");
  },
  whitelist: function (req) {
    return !!req.user.is_admin
  }
})

// custom behaviour when rate limited
limiter({
  path: '*',
  method: 'all',
  lookup: function(req) {
    return [req.user.id, req.connection.remoteAddress];
  },
  onRateLimited: function(req, res, next) {
    return next({error: {status: 429, message: 'too many requests'}});
  }
})

```

### as direct middleware

``` js
// app param is now useless
var limiter = require('express-limiter')(client)

app.post('/user/update', limiter({ lookup: function(req) { return [req.user.id, req.path, req.method]} }), function (req, res) {
  User.find(req.user.id).update(function (err) {
    if (err) next(err)
    else res.send('ok')
  })
})

// with custom data
app.get('/api/*', limiter({
    lookup: function(req) {
      return [req.user.id, 'api'];
    }
  }), function (req, res) {
  User.find(req.user.id).update(function (err) {
    if (err) next(err)
    else res.send('ok')
  })
})
```

## License MIT

Happy Rate Limiting!
