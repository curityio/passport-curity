/*
 *  Copyright 2020 Curity AB
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

const test = require('ava');
const sinon = require('sinon');
const MockRequest = require('readable-mock-req');
const { Issuer, TokenSet } = require('openid-client');
const { Strategy } = require('../lib');
const base64url = require('base64url');

const issuer = new Issuer({
    issuer: 'https://theissuer.example.com',
    userinfo_endpoint: 'https://theissuer.example.com/userinfo',
    code_challenge_methods_supported: ['plain'],
  });

const getClient = () => new issuer.Client({
    client_id: 'foo',
    client_secret: 'baz',
    respose_types: ['code'],
    redirect_uris: ['http://example.com/cb'],
  });

test('Should not call userinfo when ID token present', t => {
    const profile = { sub: "someUser", iss: "https://theissuer.example.com" };
    const idToken = "head." + base64url.encode(JSON.stringify(profile)) + ".signature";
    const tokenSet = new TokenSet({access_token: 'someToken', id_token: idToken });
    const client = getClient();
    sinon.stub(client, 'callback').callsFake(async () => tokenSet);
    sinon.spy(client, 'userinfo');

    const strategy = new Strategy({ client }, (accessToken, refreshToken, profile, callback) => {
        callback(null, profile);
    });
    strategy.success = () => {};

    const req = new MockRequest('GET', '/callback?code=somecode');
    req.session = {
        'oidc:theissuer.example.com': {
            response_type: 'code',
          }
    };

    strategy.authenticate(req);

    t.false(client.userinfo.called, "Client should not call userinfo endpoint");
});

test('Should not fallback to calling userinfo when ID token not present', t => {
    const client = getClient();
    sinon.stub(client, 'callback').callsFake(async () => {});
    sinon.spy(client, 'userinfo');

    const strategy = new Strategy({ client }, (accessToken, refreshToken, profile, callback) => {
        callback(null, profile);
    });
    strategy.success = () => {};

    const req = new MockRequest('GET', '/callback?code=somecode');
    req.session = {
        'oidc:theissuer.example.com': {
            response_type: 'code',
          }
    };

    strategy.authenticate(req);

    t.true(client.userinfo.notCalled, "Client should not call userinfo endpoint");
});


test.cb('Should fallback to calling userinfo when ID token not present and option set', t => {
    const client = getClient();
    sinon.stub(client, 'callback').callsFake(async () => {});
    sinon.stub(client, 'userinfo').callsFake(() => Promise.resolve({ sub: "someUser" }));

    const strategy = new Strategy({ client, fallbackToUserInfoRequest: true }, (accessToken, refreshToken, profile, callback) => {
        t.true(client.userinfo.called, "Client should call userinfo endpoint");
        callback(null, profile);
    });

    strategy.success = () => { t.end(null) };

    const req = new MockRequest('GET', '/callback?code=somecode');
    req.session = {
        'oidc:theissuer.example.com': {
            response_type: 'code',
          }
    };

    strategy.authenticate(req);
});
