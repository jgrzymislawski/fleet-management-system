from django.apps import AppConfig


class VehiclesConfig(AppConfig):
    name = "vehicles"

    def ready(self):
        # Ladowanie sygnalow cyklu zycia zalacznikow.
        from . import file_lifecycle  # noqa: F401
