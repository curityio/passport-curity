# passport-curity

[![Quality](https://img.shields.io/badge/quality-demo-red)](https://curity.io/resources/code-examples/status/)
[![Availability](https://img.shields.io/badge/availability-source-blue)](https://curity.io/resources/code-examples/status/)

passport-curity is a strategy for the passport library which enables an effortless integration with the Curity Identity
Server.

It covers different scenarios of authenticating a user with the Curity Identity Server using the Open ID Connect protocol.
If you're looking for an option to secure your endpoints in an Express API app with JWTs have a look at this library:
[express-oauth-jwt](https://github.com/curityio/express-oauth-jwt).

## Installation

You can install the strategy with npm.

```bash
npm install passport-curity
```

## Usage

In order to properly use the strategy you need to provide it with an openid connect client, the parameters that should
be used with the authorization request as well as a `verify` callback, which you can use to process the incoming tokens
and profile information. (See [passport documentation](http://www.passportjs.org/docs/configure/) to read more about the `verify` callback.)

### Configure the client

You can use a convenience method `discoverAndCreateClient` to quickly setup the oidc client needed by this strategy.
The method returns a `Promise`.

```javascript
discoverAndCreateClient({
    issuerUrl: 'https://example.com',
    clientID: "my-client",
    clientSecret: "S3cret!",
    redirectUris: ["http://localhost:3000/callback"],
    responseTypes: ['code', 'token']
}).then((client) => {
    // Create strategy, configure and start the Express app.
});
```

* `issuerUrl` is the URL to your instance of the Curity Identity Server. This address is used to access the `.well-known`
endpoints exposed by the Curity Identity Server in order to obtain all the necessary configuration of the different OAuth and
OpenID Connect endpoints.
* `clientID`, `clientSecret` and `redirectUris` should be filled with data used by your client registered with the
Curity Identity Server.
* `responseTypes` parameters tells the client which authorization flows will be used by the strategy. This parameter is optional and defaults to `["code"]`.

If you rather have more control on creating the client have a look at the [openid-client documentation](https://github.com/panva/node-openid-client/blob/master/docs/README.md#client) to check the
available options.

### The `verify` callback

Each passport strategy accepts a `verify` callback which can be used to properly handle incoming authorization
credentials in the Express app. E.g. create a new user account, save tokens to a database, etc. The `verify` callback
used by the `passport-curity` strategy has the following signature:

```javascript
function(accessToken, refreshToken, profile, callback) {
    callback(null, profile); // The callback function needs to be called from the verify callback.
}
```

* `accessToken` and `refreshToken` are strings containing the respective tokens, or `null` if the given token was not
returned by the given flow.
* `profile` contains a map of all the claims present in the ID token. If the ID token was not returned in the response
the strategy can fall back to requesting this data from the userinfo endpoint. See [Customization](#Customization) to
check how this can be enabled.

### Authorization code flow

Here's a minimal example showing passport configured with the Curity strategy using the authorization code flow:

```javascript
const express = require('express');

const app = express();
const passport = require('passport');
const CurityStrategy = require('passport-curity').Strategy;
const discoverAndCreateClient = require('passport-curity').discoverAndCreateClient;

const expressSession = require('express-session');

const session = {
    secret: "someSecret",
    cookie: {},
    resave: false,
    saveUninitialized: false
  };

(async () => {
    // Create the oidc client
    const client = await discoverAndCreateClient({
        issuerUrl: 'https://example.com',
        clientID: "my-client",
        clientSecret: "S3cret!",
        redirectUris: ["http://localhost:3000/callback"]
    });

    // Create the Curity Strategy object
    const strategy = new CurityStrategy({
        client,
        params: {
            scope: "openid"
        }
    }, function(accessToken, refreshToken, profile, cb) {
        cb(null, profile);
    });

    // Initialize the passport middleware
    passport.use(strategy);

    passport.serializeUser((user, done) => {
        done(null, user);
    });

    passport.deserializeUser((user, done) => {
        done(null, user);
    });

    app.use(expressSession(session));

    app.use(passport.initialize());
    app.use(passport.session());

    // The /authorize endpoint initializes the authorization process
    app.get('/authorize', passport.authenticate('curity'));

    // The callback endpoint is where the Curity Identity Server redirects the user back after positive authentication
    app.get('/callback', passport.authenticate('curity', { failureRedirect: '/failed', failureMessage: true }), function(req, res) {
        res.redirect('/');
    });

    // When a user authenticates and authorizes your app you will be able to access their data in the request object.
    app.get('/', function(req, res) {
        res.json({ profile: req.user });
    });

    app.get('/failed', function(req, res) {
        res.json({ message: "Auth failed: " + req.session.messages[0] });
    });

    app.listen(3000, function() {
        console.log("Server started on port 3000");
    });
})();
```

### Implicit flow

In order to use the implicit flow instead of the code flow you need to change a few lines in the example above:

1. Configure the client with appropriate response types:

```javascript
const client = await discoverAndCreateClient({
        issuerUrl: 'https://example.com',
        clientID: "my-client",
        clientSecret: "S3cret!",
        redirectUris: ["http://localhost:3000/callback"],
        responseTypes: ["token"]
    });
```

**Note:** If you only need the ID token you can instead use the response type `id_token`.

2. Set the `response_mode` for the strategy to `form_post` so that the tokens are posted back to the callback endpoint,
not sent in the fragment part of the url.

```javascript
const strategy = new CurityStrategy({
        client,
        params: {
            scope: "openid",
            response_mode: "form_post"
        }
    }, function(accessToken, refreshToken, profile, cb) {
        ...
    });
```

**Note:** If you configure the client with more response types then you have to add a `response_type` parameter to the
`params` map.

3. Configure the callback endpoint to accept POST requests and to properly parse the body of the request:

```javascript
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/auth/example/callback', passport.authenticate('curity', { failureRedirect: '/failed', failureMessage: true}), function(req, res) {
        res.redirect('/');
    });
```

#### Obtaining both: ID token and access token

It's possible to obtain both the ID token and the access token in one request in an implicit flow. To do that just
provide both response types together as one value:

```javascript
const client = await discoverAndCreateClient({
        issuerUrl: 'https://example.com',
        clientID: "my-client",
        clientSecret: "S3cret!",
        redirectUris: ["http://localhost:3000/callback"],
        responseTypes: ["token id_token"]
    });
```

## Customization

### userinfo fallback

The user profile data will normally be decoded from the ID token. However, if the ID token is not present in the
response the strategy can fall back to requesting the userinfo endpoint of the Curity Identity Server. By default this option is
disabled. If you want to enable it add `fallbackToUserInfoRequest: true` to the strategy options:

```javascript
const strategy = new CurityStrategy({
    client,
    params: {
        scope: "openid"
    },
    fallbackToUserInfoRequest: true
}, function(accessToken, refreshToken, profile, cb) {
    ...
});
```

### Setting authorization parameters

The `params` map in the Curity strategy options is a map of the parameters that are sent together with the authorization
request. E.g. you can set the `prompt` parameter to use the feature as described in the OpenID Connect protocol. So if
you add to the `params` map `prompt: "login"`, then you will always see a login page regardless of the user being logged
in or not.

Another popular parameter you can use is the `scope` parameter, where you can provide a string with space-delimited
scope tokens - the ones that your app need in order to properly access the user's resources. E.g. `scope: "openid profile email"`.

Below is the list of all the parameters that can be set for requests made by this strategy:

* acr_values
* audience
* claims.id_token
* claims.userinfo
* claims_locales
* client_id
* code_challenge_method
* code_challenge
* display
* id_token_hint
* login_hint
* max_age
* nonce
* prompt
* redirect_uri
* registration
* request_uri
* request
* resource
* response_mode
* response_type
* scope
* ui_locales

### Other customization

The Curity passport strategy is based on the `openid-client` library written by Filip Skokan. If you need some more
customization and fine-grained tuning you can have a look the [openid-client documentation](https://github.com/panva/node-openid-client/blob/master/docs/README.md).

## Questions and Support

For questions and support, contact Curity AB:

> Curity AB
>
> info@curity.io
> 
> [https://curity.io](https://curity.io)

Copyright (C) 2020 Curity AB.
