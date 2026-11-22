
import hashlib

from rest_framework.throttling import SimpleRateThrottle


class LoginIPThrottle(SimpleRateThrottle):
    scope = "login_ip"
    rate = "10/min"

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)

        if not ident:
            return None

        return self.cache_format % {
            "scope": self.scope,
            "ident": ident,
        }


class LoginAccountThrottle(SimpleRateThrottle):
    scope = "login_account"
    rate = "30/hour"
    def get_cache_key(self, request, view):
        username = request.data.get("username", "")

        if not isinstance(username, str):
            return None

        username = username.strip().casefold()

        if not username:
            return None

        identifier = hashlib.sha256(
            username.encode("utf-8")
        ).hexdigest()

        return self.cache_format % {
            "scope": self.scope,
            "ident": identifier,
        }
