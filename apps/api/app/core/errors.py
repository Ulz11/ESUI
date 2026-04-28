"""Common HTTP error helpers."""

from fastapi import HTTPException, status


def not_found(what: str = "resource") -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, f"{what} not found")


def forbidden(reason: str = "forbidden") -> HTTPException:
    return HTTPException(status.HTTP_403_FORBIDDEN, reason)


def bad_request(reason: str) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, reason)


def too_many(reason: str = "rate limited") -> HTTPException:
    return HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, reason)


def server_error(reason: str = "internal error") -> HTTPException:
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, reason)
