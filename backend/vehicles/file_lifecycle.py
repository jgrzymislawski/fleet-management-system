"""Usuwanie nieuzywanych plikow dokumentow po zatwierdzeniu transakcji.

Nie usuwamy plikow przed zatwierdzeniem zmian w bazie. Sprawdzamy tez,
czy jakikolwiek inny rekord nadal odwoluje sie do tego samego pliku.
"""

import logging

from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import VehicleDocument


logger = logging.getLogger(__name__)
UPLOAD_PREFIX = "vehicle_documents/"


def schedule_file_cleanup(file_name, storage, using):
    """Zaplanuj usuniecie tylko pliku nieuzywanego przez zaden dokument."""
    if not file_name or not file_name.startswith(UPLOAD_PREFIX):
        return

    def cleanup_after_commit():
        try:
            # Oszczedzamy pliki wspoldzielone oraz ponownie przypisane.
            still_used = (
                VehicleDocument.objects.using(using)
                .filter(file=file_name)
                .exists()
            )
            if still_used:
                return
            storage.delete(file_name)
        except Exception:
            # Zapis w bazie zostal juz zatwierdzony: blad magazynu
            # nie powinien zmieniac udanej odpowiedzi API w blad 500.
            logger.exception(
                "Nie udalo sie usunac starego pliku dokumentu."
            )

    transaction.on_commit(cleanup_after_commit, using=using)


@receiver(
    pre_save,
    sender=VehicleDocument,
    dispatch_uid="vehicles.capture_previous_document_file",
)
def remember_previous_file(sender, instance, using, raw=False, **kwargs):
    instance._previous_document_file = None
    if raw or instance.pk is None:
        return

    instance._previous_document_file = (
        sender.objects.using(using)
        .filter(pk=instance.pk)
        .values_list("file", flat=True)
        .first()
    )


@receiver(
    post_save,
    sender=VehicleDocument,
    dispatch_uid="vehicles.cleanup_replaced_document_file",
)
def cleanup_replaced_file(
    sender, instance, created, raw, using, update_fields=None, **kwargs
):
    old_name = getattr(instance, "_previous_document_file", None)
    if hasattr(instance, "_previous_document_file"):
        del instance._previous_document_file

    if created or raw:
        return
    if update_fields is not None and "file" not in update_fields:
        return

    new_name = instance.file.name if instance.file else None
    if old_name and old_name != new_name:
        schedule_file_cleanup(old_name, instance.file.storage, using)


@receiver(
    post_delete,
    sender=VehicleDocument,
    dispatch_uid="vehicles.cleanup_deleted_document_file",
)
def cleanup_deleted_file(sender, instance, using, **kwargs):
    if instance.file and instance.file.name:
        schedule_file_cleanup(
            instance.file.name, instance.file.storage, using
        )
