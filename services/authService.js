global.fetch = require('node-fetch');
global.navigator = () => null;
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');
const cons = require('consolidate');
const poolData = {
   UserPoolId: process.env.poolId,
   ClientId: process.env.clientId
};
const pool_region = process.env.poolRegion;
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
const request = require("request");
const jwt = require("jsonwebtoken");
const jwkToPem = require("jwk-to-pem");

exports.Register = function (body, callback) {
   var name = body.name;
   var email = body.email;
   var password = body.password;
   var attributeList = [];
   
   attributeList.push(new AmazonCognitoIdentity.CognitoUserAttribute({ Name: "email", Value: email }));
   userPool.signUp(name, password, attributeList, null, function (err, result) {
     if (err)
         callback(err);
     var cognitoUser = result.user;
     callback(null, cognitoUser);
   })
};

exports.Login = function (body, callback) {
    var userName = body.name;
    var password = body.password;
    var authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
         Username: userName,
         Password: password
     });
     var userData = {
         Username: userName,
         Pool: userPool
     }
     var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
     cognitoUser.authenticateUser(authenticationDetails, {
         onSuccess: function (result) {
            var accesstoken = result.getAccessToken().getJwtToken();
            var idToken = result.getIdToken().getJwtToken();
            var refreshToken = result.getRefreshToken().getToken();
            callback(null, {
                accesstoken: accesstoken,
                idToken: idToken,
                refreshToken: refreshToken
            });
         },
         onFailure: (function (err) {
            callback(err);
        })
    })
 };

 exports.Validate = function(token, callback){
    request({
        url : `https://cognito-idp.${pool_region}.amazonaws.com/${poolData.UserPoolId}/.well-known/jwks.json`,
        json : true
     }, function(error, response, body){
        if (!error && response.statusCode === 200) {
            pems = {};
            var keys = body['keys'];
            for(var i = 0; i < keys.length; i++) {
                 var key_id = keys[i].kid;
                 var modulus = keys[i].n;
                 var exponent = keys[i].e;
                 var key_type = keys[i].kty;
                 var jwk = { kty: key_type, n: modulus, e: exponent};
                 var pem = jwkToPem(jwk);
                 pems[key_id] = pem;
            }
         var decodedJwt = jwt.decode(token, {complete: true});
                 if (!decodedJwt) {
                     console.log("Not a valid JWT token");
                     callback(new Error('Not a valid JWT token'));
                 }
                 var kid = decodedJwt.header.kid;
                 var pem = pems[kid];
                 if (!pem) {
                     console.log('Invalid token');
                     callback(new Error('Invalid token'));
                 }
                jwt.verify(token, pem, function(err, payload) {
                     if(err) {
                         console.log("Invalid Token.");
                         callback(new Error('Invalid token'));
                     } else {
                          console.log("Valid Token.");
                          callback(null, {message:"Valid token",userData: payload});
                     }
                });
        } else {
              console.log("Error! Unable to download JWKs");
              callback(error);
        }
    });
 }