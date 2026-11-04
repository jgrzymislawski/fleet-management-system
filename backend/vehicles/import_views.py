from django.db import IntegrityError, transaction
from django.http import HttpResponse

from openpyxl import load_workbook

from auditlog.context import set_actor

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from organizations.models import Company

from .models import Vehicle
from .serializers import VehicleSerializer

from .views import (
    can_edit_company,
    get_membership,
    user_is_superuser,
)

from .import_utils import (
    VEHICLE_IMPORT_HEADERS,
    VEHICLE_TYPE_MAPPING,
    FUEL_TYPE_MAPPING,
    STATUS_MAPPING,
    create_vehicle_import_template,
    normalize_registration_number,
    normalize_text,
    normalize_vin,
    parse_choice,
    parse_date,
    parse_integer,
)


class VehicleImportTemplateView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    def get(
        self,
        request,
    ):
        output = (
            create_vehicle_import_template()
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
            'filename="flotivo-szablon-importu-pojazdow.xlsx"'
        )

        return response


class VehicleImportView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    def post(
        self,
        request,
    ):
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
            in VEHICLE_IMPORT_HEADERS
            if header not in received_headers
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

        membership = get_membership(
            request.user
        )

        if (
            membership is None
            and not user_is_superuser(
                request.user
            )
        ):
            return Response(
                {
                    "detail": (
                        "Użytkownik nie jest "
                        "przypisany do żadnej "
                        "organizacji."
                    )
                },
                status=(
                    status.HTTP_403_FORBIDDEN
                ),
            )

        imported = 0
        skipped = 0
        errors = []

        seen_registration_numbers = set()
        seen_vins = set()

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
                in VEHICLE_IMPORT_HEADERS
            }

            try:
                brand = normalize_text(
                    row_data[
                        "Marka"
                    ]
                )

                model = normalize_text(
                    row_data[
                        "Model"
                    ]
                )

                registration_number = (
                    normalize_registration_number(
                        row_data[
                            "Numer rejestracyjny"
                        ]
                    )
                )

                vin = normalize_vin(
                    row_data[
                        "VIN"
                    ]
                )

                company_name = normalize_text(
                    row_data[
                        "Spółka"
                    ]
                )

                branch = normalize_text(
                    row_data[
                        "Oddział"
                    ]
                )

                if not brand:
                    raise ValueError(
                        (
                            "Pole „Marka” "
                            "jest wymagane."
                        )
                    )

                if not model:
                    raise ValueError(
                        (
                            "Pole „Model” "
                            "jest wymagane."
                        )
                    )

                if not registration_number:
                    raise ValueError(
                        (
                            "Pole „Numer rejestracyjny” "
                            "jest wymagane."
                        )
                    )

                year = parse_integer(
                    row_data[
                        "Rok"
                    ],
                    "Rok",
                    required=True,
                    minimum=1900,
                    maximum=2100,
                )

                mileage = parse_integer(
                    row_data[
                        "Przebieg"
                    ],
                    "Przebieg",
                    required=False,
                    minimum=0,
                )

                if mileage is None:
                    mileage = 0

                vehicle_type = (
                    parse_choice(
                        row_data[
                            "Typ pojazdu"
                        ],
                        "Typ pojazdu",
                        VEHICLE_TYPE_MAPPING,
                        required=True,
                    )
                )

                fuel_type = (
                    parse_choice(
                        row_data[
                            "Rodzaj paliwa"
                        ],
                        "Rodzaj paliwa",
                        FUEL_TYPE_MAPPING,
                        required=False,
                    )
                )

                vehicle_status = (
                    parse_choice(
                        row_data[
                            "Status"
                        ],
                        "Status",
                        STATUS_MAPPING,
                        required=True,
                    )
                )

                inspection_date = (
                    parse_date(
                        row_data[
                            "Termin przeglądu"
                        ],
                        "Termin przeglądu",
                    )
                )

                insurance_date = (
                    parse_date(
                        row_data[
                            "Termin OC"
                        ],
                        "Termin OC",
                    )
                )

                company = self.get_company(
                    request=request,
                    membership=membership,
                    company_name=company_name,
                )

                organization = (
                    self.get_organization(
                        request=request,
                        membership=membership,
                        company=company,
                    )
                )

                if (
                    company is not None
                    and (
                        company.organization_id
                        != organization.id
                    )
                ):
                    raise ValueError(
                        (
                            "Wybrana spółka nie należy "
                            "do organizacji importującego "
                            "użytkownika."
                        )
                    )

                registration_key = (
                    organization.id,
                    registration_number,
                )

                if (
                    registration_key
                    in seen_registration_numbers
                ):
                    raise ValueError(
                        (
                            "Numer rejestracyjny "
                            f"{registration_number} "
                            "występuje więcej niż raz "
                            "w pliku dla tej samej "
                            "organizacji."
                        )
                    )

                seen_registration_numbers.add(
                    registration_key
                )

                if vin:
                    vin_key = (
                        organization.id,
                        vin,
                    )

                    if vin_key in seen_vins:
                        raise ValueError(
                            (
                                "VIN "
                                f"{vin} "
                                "występuje więcej niż raz "
                                "w pliku dla tej samej "
                                "organizacji."
                            )
                        )

                    seen_vins.add(
                        vin_key
                    )

                if (
                    Vehicle.objects
                    .filter(
                        organization=organization,
                        registration_number__iexact=(
                            registration_number
                        ),
                    )
                    .exists()
                ):
                    skipped += 1

                    errors.append(
                        {
                            "row": row_number,
                            "message": (
                                "Pojazd o numerze "
                                "rejestracyjnym "
                                f"{registration_number} "
                                "już istnieje w tej "
                                "organizacji."
                            ),
                            "type": "duplicate",
                        }
                    )

                    continue

                if (
                    vin
                    and Vehicle.objects
                    .filter(
                        organization=organization,
                        vin__iexact=vin,
                    )
                    .exists()
                ):
                    skipped += 1

                    errors.append(
                        {
                            "row": row_number,
                            "message": (
                                "Pojazd o VIN "
                                f"{vin} już istnieje "
                                "w tej organizacji."
                            ),
                            "type": "duplicate",
                        }
                    )

                    continue

                serializer_data = {
                    "brand": brand,
                    "model": model,
                    "registration_number": (
                        registration_number
                    ),
                    "vin": (
                        vin
                        if vin
                        else None
                    ),
                    "year": year,
                    "vehicle_type": (
                        vehicle_type
                    ),
                    "fuel_type": (
                        fuel_type
                    ),
                    "mileage": mileage,
                    "status": (
                        vehicle_status
                    ),
                    "company": (
                        company.id
                        if company
                        else None
                    ),
                    "branch": branch,
                    "inspection_expiry_date": (
                        inspection_date
                    ),
                    "insurance_expiry_date": (
                        insurance_date
                    ),
                }

                serializer = VehicleSerializer(
                    data=serializer_data,
                    context={
                        "request": request,
                    },
                )

                serializer.is_valid(
                    raise_exception=True
                )

                with transaction.atomic():
                    with set_actor(
                        request.user
                    ):
                        serializer.save(
                            organization=(
                                organization
                            )
                        )

                imported += 1

            except ValueError as exc:
                errors.append(
                    {
                        "row": row_number,
                        "message": str(
                            exc
                        ),
                        "type": "validation",
                    }
                )

            except IntegrityError:
                errors.append(
                    {
                        "row": row_number,
                        "message": (
                            "Nie udało się zapisać "
                            "pojazdu z powodu "
                            "konfliktu danych."
                        ),
                        "type": "database",
                    }
                )

            except Exception as exc:
                error_detail = getattr(
                    exc,
                    "detail",
                    None,
                )

                if (
                    error_detail
                    is not None
                ):
                    message = str(
                        error_detail
                    )
                else:
                    message = str(
                        exc
                    )

                errors.append(
                    {
                        "row": row_number,
                        "message": message,
                        "type": "validation",
                    }
                )

        return Response(
            {
                "imported": imported,
                "skipped": skipped,
                "errors_count": (
                    len(errors)
                ),
                "errors": errors,
            },
            status=(
                status.HTTP_200_OK
            ),
        )

    def get_company(
        self,
        request,
        membership,
        company_name,
    ):
        if membership is not None:
            if not company_name:
                if (
                    membership.role
                    == "admin"
                ):
                    return None

                raise ValueError(
                    (
                        "Pole „Spółka” "
                        "jest wymagane."
                    )
                )

            companies = (
                Company.objects
                .filter(
                    organization=(
                        membership.organization
                    ),
                    name__iexact=(
                        company_name
                    ),
                    is_active=True,
                )
            )

            if not companies.exists():
                raise ValueError(
                    (
                        "Nie znaleziono aktywnej "
                        "spółki "
                        f"„{company_name}” "
                        "w Twojej organizacji."
                    )
                )

            if companies.count() > 1:
                raise ValueError(
                    (
                        "W Twojej organizacji "
                        "istnieje więcej niż jedna "
                        "aktywna spółka o nazwie "
                        f"„{company_name}”."
                    )
                )

            company = (
                companies.first()
            )

            if (
                membership.role
                != "admin"
                and not can_edit_company(
                    membership,
                    company,
                )
            ):
                raise ValueError(
                    (
                        "Nie masz uprawnień "
                        "do dodawania pojazdów "
                        "do spółki "
                        f"„{company.name}”."
                    )
                )

            return company

        if user_is_superuser(
            request.user
        ):
            if not company_name:
                raise ValueError(
                    (
                        "Superadministrator bez "
                        "przypisanej organizacji "
                        "musi podać spółkę."
                    )
                )

            companies = (
                Company.objects
                .filter(
                    name__iexact=(
                        company_name
                    ),
                    is_active=True,
                )
            )

            if not companies.exists():
                raise ValueError(
                    (
                        "Nie znaleziono aktywnej "
                        "spółki "
                        f"„{company_name}”."
                    )
                )

            if companies.count() > 1:
                raise ValueError(
                    (
                        "Nazwa spółki "
                        f"„{company_name}” "
                        "nie jest jednoznaczna "
                        "między organizacjami."
                    )
                )

            return (
                companies.first()
            )

        raise ValueError(
            (
                "Nie można ustalić "
                "spółki użytkownika."
            )
        )

    def get_organization(
        self,
        request,
        membership,
        company,
    ):
        if membership is not None:
            return (
                membership.organization
            )

        if user_is_superuser(
            request.user
        ):
            if company is None:
                raise ValueError(
                    (
                        "Nie można ustalić "
                        "organizacji dla pojazdu."
                    )
                )

            return (
                company.organization
            )

        raise ValueError(
            (
                "Nie można ustalić "
                "organizacji użytkownika."
            )
        )