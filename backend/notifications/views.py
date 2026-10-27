from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from organizations.models import OrganizationMembership

from .models import (
    NotificationPreference,
    NotificationSettings,
)

from .serializers import (
    NotificationPreferenceSerializer,
    NotificationSettingsSerializer,
)


def get_admin_membership(user):
    membership = (
        OrganizationMembership.objects
        .select_related("organization")
        .filter(user=user)
        .first()
    )

    if membership is None:
        raise PermissionDenied(
            "Nie jesteś przypisany do żadnej organizacji."
        )

    if membership.role != "admin":
        raise PermissionDenied(
            "Tylko administrator organizacji może zmieniać te ustawienia."
        )

    return membership


class NotificationPreferenceView(APIView):
    permission_classes = [IsAuthenticated]

    def get_preference(self, user):
        preference, created = (
            NotificationPreference.objects.get_or_create(
                user=user,
            )
        )

        return preference

    def get(self, request):
        preference = self.get_preference(
            request.user
        )

        serializer = NotificationPreferenceSerializer(
            preference
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        preference = self.get_preference(
            request.user
        )

        serializer = NotificationPreferenceSerializer(
            preference,
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save()

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def patch(self, request):
        preference = self.get_preference(
            request.user
        )

        serializer = NotificationPreferenceSerializer(
            preference,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save()

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class AdminNotificationSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get_settings(self, user):
        membership = get_admin_membership(
            user
        )

        settings_object, created = (
            NotificationSettings.objects.get_or_create(
                organization=membership.organization,
            )
        )

        return settings_object

    def get(self, request):
        settings_object = self.get_settings(
            request.user
        )

        serializer = NotificationSettingsSerializer(
            settings_object
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        settings_object = self.get_settings(
            request.user
        )

        serializer = NotificationSettingsSerializer(
            settings_object,
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save()

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def patch(self, request):
        settings_object = self.get_settings(
            request.user
        )

        serializer = NotificationSettingsSerializer(
            settings_object,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save()

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )