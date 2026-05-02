"""Cloudflare R2 (S3-compatible) client — uploads, signed URLs."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from uuid import UUID

import boto3
from botocore.client import Config

from app.core.config import settings

_client = None


def get_client():
    """Return a boto3 S3 client configured for R2. Lazy-init."""
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=settings.r2_endpoint_url,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )
    return _client


def build_key(user_id: UUID, file_id: UUID, ext: str = "") -> str:
    """`files/<user>/<yyyy>/<mm>/<file_id><.ext>`"""
    now = datetime.now(tz=UTC)
    suffix = f".{ext.lstrip('.')}" if ext else ""
    return f"files/{user_id}/{now.year:04d}/{now.month:02d}/{file_id}{suffix}"


async def put_bytes(key: str, body: bytes, content_type: str) -> None:
    client = get_client()
    await asyncio.to_thread(
        client.put_object,
        Bucket=settings.r2_bucket,
        Key=key,
        Body=body,
        ContentType=content_type,
    )


async def get_bytes(key: str) -> bytes:
    client = get_client()
    obj = await asyncio.to_thread(
        client.get_object, Bucket=settings.r2_bucket, Key=key
    )
    return obj["Body"].read()


async def presign_get(key: str, expires_in: int = 600) -> str:
    """10-minute default. Returned URL works without auth."""
    client = get_client()
    return await asyncio.to_thread(
        client.generate_presigned_url,
        "get_object",
        Params={"Bucket": settings.r2_bucket, "Key": key},
        ExpiresIn=expires_in,
    )


async def delete(key: str) -> None:
    client = get_client()
    await asyncio.to_thread(
        client.delete_object, Bucket=settings.r2_bucket, Key=key
    )
