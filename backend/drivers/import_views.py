from django.db import IntegrityError, transaction
from django.http import HttpResponse

from openpyxl import load_workbook

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from auditlog.context import set_actor

from organizations.models import OrganizationMembership

from .models import Driver

from .import_utils import (
    DRIVER_IMPORT_HEADERS,
    create_driver_import_template,
    normalize_license_number,
    normalize_text,
    parse_date,
    parse_license_categories,
)


def get_membership(user):
    if not getattr(
        user,
        "is_authenticated",
        False,
    ):
        return None

    return (
        OrganizationMembership.objects
        .select_related(
            "organization"
        )
        .filter(
            user=user
        )
        .first()
    )


def get_import_organization(user):
    membership = get_membership(
        user
    )

    if membership is None:
        return None, (
            "Użytkownik nie jest przypisany "
            "do żadnej organizacji."
        )

    if membership.role != "admin":
        return None, (
            "Tylko administrator organizacji "
            "może importować kierowców."
        )

    if not membership.organization.is_active:
        return None, (
            "Organizacja użytkownika jest nieaktywna."
        )

    return (
        membership.organization,
        None,
    )


class DriverImportTemplateView(
    APIView
):
    permission_classes = [
        IsAuthenticated,
    ]

    def get(
        self,
        request,
    ):
        output = (
            create_driver_import_template()
        )

        response = HttpResponse(
            output.getvalue(),
            content_type=(
                "application/"
                "vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            ),
        )

        response[
            "Content-Disposition"
        ] = (
            'attachment; '
            'filename="flotivo-szablon-importu-kierowcow.xlsx"'
        )

        return response


class DriverImportView(
    APIView
):
    permission_classes = [
        IsAuthenticated,
    ]

    def post(
        self,
        request,
    ):
        organization, organization_error = (
            get_import_organization(
                request.user
            )
        )

        if organization is None:
            return Response(
                {
                    "detail": (
                        organization_error
                    )
                },
                status=(
                    status.HTTP_403_FORBIDDEN
                ),
            )

        uploaded_file = (
            request.FILES.get(
                "file"
            )
        )

        if uploaded_file is None:
            return Response(
                {
                    "detail": (
                        "Nie wybrano pliku."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        filename = (
            uploaded_file.name
            .lower()
        )

        if not filename.endswith(
            ".xlsx"
        ):
            return Response(
                {
                    "detail": (
                        "Obsługiwane są wyłącznie "
                        "pliki XLSX."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        try:
            workbook = load_workbook(
                uploaded_file,
                data_only=True,
            )

        except Exception:
            return Response(
                {
                    "detail": (
                        "Nie udało się odczytać "
                        "pliku XLSX."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        worksheet = workbook.active

        headers = [
            normalize_text(
                cell.value
            )
            for cell
            in worksheet[1]
        ]

        received_headers = [
            header
            for header
            in headers
            if header
        ]

        missing_headers = [
            header
            for header
            in DRIVER_IMPORT_HEADERS
            if (
                header
                not in received_headers
            )
        ]

        duplicate_headers = [
            header
            for header
            in set(
                received_headers
            )
            if (
                received_headers.count(
                    header
                )
                > 1
            )
        ]

        if missing_headers:
            return Response(
                {
                    "detail": (
                        "W pliku brakuje "
                        "wymaganych kolumn."
                    ),
                    "missing_headers": (
                        missing_headers
                    ),
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        if duplicate_headers:
            return Response(
                {
                    "detail": (
                        "W pliku znajdują się "
                        "zduplikowane nagłówki."
                    ),
                    "duplicate_headers": (
                        duplicate_headers
                    ),
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        header_indexes = {
            header: index
            for index, header
            in enumerate(headers)
            if header
        }

        imported = 0
        skipped = 0
        errors = []

        seen_license_numbers = set()

        for (
            row_number,
            row,
        ) in enumerate(
            worksheet.iter_rows(
                min_row=2,
                values_only=True,
            ),
            start=2,
        ):
            if all(
                value in (
                    None,
                    "",
                )
                for value in row
            ):
                continue

            row_data = {
                header: (
                    row[
                        header_indexes[
                            header
                        ]
                    ]
                    if (
                        header_indexes[
                            header
                        ]
                        < len(row)
                    )
                    else None
                )
                for header
                in DRIVER_IMPORT_HEADERS
            }

            try:
                first_name = (
                    normalize_text(
                        row_data[
                            "Imię"
                        ]
                    )
                )

                last_name = (
                    normalize_text(
                        row_data[
                            "Nazwisko"
                        ]
                    )
                )

                license_number = (
                    normalize_license_number(
                        row_data[
                            "Numer prawa jazdy"
                        ]
                    )
                )

                license_categories = (
                    parse_license_categories(
                        row_data[
                            "Kategorie prawa jazdy"
                        ]
                    )
                )

                phone_number = (
                    normalize_text(
                        row_data[
                            "Telefon"
                        ]
                    )
                )

                if not first_name:
                    raise ValueError(
                        "Pole „Imię” jest wymagane."
                    )

                if not last_name:
                    raise ValueError(
                        "Pole „Nazwisko” jest wymagane."
                    )

                if not license_number:
                    raise ValueError(
                        (
                            "Pole „Numer prawa jazdy” "
                            "jest wymagane."
                        )
                    )

                license_key = (
                    organization.id,
                    license_number,
                )

                if (
                    license_key
                    in seen_license_numbers
                ):
                    raise ValueError(
                        (
                            "Numer prawa jazdy "
                            f"{license_number} "
                            "występuje więcej niż "
                            "raz w pliku dla tej samej "
                            "organizacji."
                        )
                    )

                seen_license_numbers.add(
                    license_key
                )

                if (
                    Driver.objects
                    .filter(
                        organization=organization,
                        license_number__iexact=(
                            license_number
                        ),
                    )
                    .exists()
                ):
                    skipped += 1

                    errors.append(
                        {
                            "row": (
                                row_number
                            ),
                            "message": (
                                "Kierowca o numerze "
                                "prawa jazdy "
                                f"{license_number} "
                                "już istnieje w tej "
                                "organizacji."
                            ),
                            "type": (
                                "duplicate"
                            ),
                        }
                    )

                    continue

                license_expiry_date = (
                    parse_date(
                        row_data[
                            "Ważność prawa jazdy"
                        ],
                        "Ważność prawa jazdy",
                    )
                )

                medical_exam_expiry_date = (
                    parse_date(
                        row_data[
                            "Badania lekarskie"
                        ],
                        "Badania lekarskie",
                    )
                )

                hired_at = (
                    parse_date(
                        row_data[
                            "Data zatrudnienia"
                        ],
                        "Data zatrudnienia",
                    )
                )

                with transaction.atomic():
                    with set_actor(
                        request.user
                    ):
                        Driver.objects.create(
                            organization=(
                                organization
                            ),
                            first_name=(
                                first_name
                            ),
                            last_name=(
                                last_name
                            ),
                            license_number=(
                                license_number
                            ),
                            license_categories=(
                                license_categories
                            ),
                            license_expiry_date=(
                                license_expiry_date
                            ),
                            medical_exam_expiry_date=(
                                medical_exam_expiry_date
                            ),
                            phone_number=(
                                phone_number
                            ),
                            hired_at=(
                                hired_at
                            ),
                        )

                imported += 1

            except ValueError as exc:
                errors.append(
                    {
                        "row": (
                            row_number
                        ),
                        "message": (
                            str(exc)
                        ),
                        "type": (
                            "validation"
                        ),
                    }
                )

            except IntegrityError:
                errors.append(
                    {
                        "row": (
                            row_number
                        ),
                        "message": (
                            "Nie udało się zapisać "
                            "kierowcy z powodu "
                            "konfliktu danych."
                        ),
                        "type": (
                            "database"
                        ),
                    }
                )

            except Exception as exc:
                errors.append(
                    {
                        "row": (
                            row_number
                        ),
                        "message": (
                            str(exc)
                        ),
                        "type": (
                            "validation"
                        ),
                    }
                )

        return Response(
            {
                "imported": (
                    imported
                ),
                "skipped": (
                    skipped
                ),
                "errors_count": (
                    len(errors)
                ),
                "errors": (
                    errors
                ),
            },
            status=(
                status.HTTP_200_OK
            ),
        )