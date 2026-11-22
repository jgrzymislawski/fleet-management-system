
from django.conf import settings
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import (
    csrf_protect,
    ensure_csrf_cookie,
)
from django.views.decorators.http import require_GET

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.exceptions import (
    InvalidToken,
    TokenError,
)
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)


COOKIE_NAME = "flotivo_refresh"
COOKIE_PATH = "/api/auth/token/"


def set_refresh_cookie(response, refresh_token):
    max_age = int(
        settings.SIMPLE_JWT[
            "REFRESH_TOKEN_LIFETIME"
        ].total_seconds()
    )

    response.set_cookie(
        key=COOKIE_NAME,
        value=refresh_token,
        max_age=max_age,
        path=COOKIE_PATH,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Lax",
    )


def delete_refresh_cookie(response):
    response.delete_cookie(
        key=COOKIE_NAME,
        path=COOKIE_PATH,
        samesite="Lax",
    )


@require_GET
@ensure_csrf_cookie
def csrf_cookie(request):
    return JsonResponse({"detail": "OK"})


@method_decorator(csrf_protect, name="dispatch")
class CookieTokenObtainPairView(TokenObtainPairView):

    def post(self, request, *args, **kwargs):
        response = super().post(
            request,
            *args,
            **kwargs,
        )

        if response.status_code == status.HTTP_200_OK:
            refresh_token = response.data.pop(
                "refresh",
                None,
            )

            if refresh_token:
                set_refresh_cookie(
                    response,
                    refresh_token,
                )

        return response


@method_decorator(csrf_protect, name="dispatch")
class CookieTokenRefreshView(TokenRefreshView):

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(
            COOKIE_NAME
        )

        if not refresh_token:
            return Response(
                {"detail": "Brak aktywnej sesji."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = self.get_serializer(
            data={"refresh": refresh_token}
        )

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(str(exc)) from exc

        data = serializer.validated_data

        response = Response(
            {"access": data["access"]},
            status=status.HTTP_200_OK,
        )

        new_refresh = data.get("refresh")

        if new_refresh:
            set_refresh_cookie(
                response,
                new_refresh,
            )

        return response


@method_decorator(csrf_protect, name="dispatch")
class CookieTokenLogoutView(APIView):

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(
            COOKIE_NAME
        )

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except TokenError:
                pass

        response = Response(
            status=status.HTTP_204_NO_CONTENT
        )

        delete_refresh_cookie(response)

        return response
