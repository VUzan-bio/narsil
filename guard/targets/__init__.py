"""Module 1: Target definition from WHO mutation catalogue."""

from guard.targets.who_parser import WHOCatalogueParser
from guard.targets.resolver import TargetResolver

__all__ = ["WHOCatalogueParser", "TargetResolver"]
