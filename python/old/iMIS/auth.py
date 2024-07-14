from os import environ
import logging
import time
import requests
from .sitedetails import SETTINGS

AUTH_HEADER = { 'content-type': "application/x-www-form-urlencoded", "X-AUTH-ATTEMPT" : "Y"}
AUTH_DATA = { "Username" : SETTINGS["username"], "Password": SETTINGS["password"], "Grant_type":"password" }

from requests.auth import AuthBase

class iMISAuth(AuthBase):
    expires = time.time()-100
    access_token = None
    session = None
    def __init__(self, session):
        self.session = session

    def token(self, regen=False):
        #no token or expired/about to expire: reauth
        if regen or not self.token or time.time() >= self.expires:
            r = self.session.post("/token", headers=AUTH_HEADER, data=AUTH_DATA)
            r.raise_for_status()
            token_data =  r.json()
            self.access_token = token_data["access_token"]
            #token time is usually 2 weeks, subtract a few hours from that just to make sure we're refreshing in time.
            self.expires = time.time()+token_data["expires_in"]-(60*60*3)
        #return token string
        return "Bearer %s" % self.access_token

    def reauthhook(self, res, *args, **kwargs):
        if res.status_code == requests.codes.unauthorized:
            logging.warn('Token rejected, refreshing')
            req = res.request
            req.headers['Authorization'] = self.token(True)
            logging.debug(f'Resending request: {req.method} - {req.url}')
            return session.send(res.request)

    def __call__(self, r):
        # modify and return the request only if not auth attempt.
        if "X-AUTH-ATTEMPT" not in r.headers:
            r.headers['Authorization'] = self.token()
            # add hook for reauth if 401
            r.register_hook('response', self.reauthhook)
        else :
            del r.headers["X-AUTH-ATTEMPT"]
        return r
