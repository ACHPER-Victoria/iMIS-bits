from requests import Session
from urllib.parse import urljoin

from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry
from os import environ
from .auth import iMISAuth
from .sitedetails import SETTINGS

retry_strategy = Retry(
    total=20,
    status_forcelist=[413, 418, 429, 500, 502, 503, 504],
    method_whitelist=["HEAD", "GET", "PUT", "POST", "DELETE", "OPTIONS", "TRACE"],
    backoff_factor=0.8
)

# https://findwork.dev/blog/advanced-usage-python-requests-timeouts-retries-hooks/
class TimeoutHTTPAdapter(HTTPAdapter):
    def __init__(self, *args, **kwargs):
        self.timeout = None
        if "timeout" in kwargs:
            self.timeout = kwargs["timeout"]
            del kwargs["timeout"]
        super().__init__(*args, **kwargs)

    def send(self, request, **kwargs):
        timeout = kwargs.get("timeout")
        if timeout is None:
            kwargs["timeout"] = self.timeout
        return super().send(request, **kwargs)

# https://stackoverflow.com/a/51026159
class LiveServerSession(Session):
    def __init__(self, prefix_url=None, *args, **kwargs):
        super(LiveServerSession, self).__init__(*args, **kwargs)
        self.prefix_url = prefix_url

    def request(self, method, url, *args, **kwargs):
        url = urljoin(self.prefix_url, url)
        return super(LiveServerSession, self).request(method, url, *args, **kwargs)

web = LiveServerSession(prefix_url=SETTINGS["API_URL"])
adapter = TimeoutHTTPAdapter(timeout=10, max_retries=retry_strategy)
web.mount("https://", adapter)
web.mount("http://", adapter)
web.auth = iMISAuth(web)
web.headers.update({'content-type': "application/json"})
