"""Manual ops: docker compose exec worker python -m app.cli <cmd>"""
import asyncio
import click
from .sources.registry import run_due_sources, run_source_by_key
from .apply.runner import process_queue
from .heartbeat import beat


@click.group()
def cli(): ...


@cli.command()
@click.argument("key", required=False)
def scrape(key):
    """Run all due sources, or a single source by key."""
    if key:
        asyncio.run(run_source_by_key(key, force=True))
    else:
        asyncio.run(run_due_sources(force=True))


@cli.command()
@click.argument("n", type=int, default=1)
def apply(n):
    """Process N queued applications."""
    asyncio.run(process_queue(limit=n))


@cli.command()
def selftest():
    """Verify DB connectivity + heartbeat."""
    beat()
    click.echo("ok")


if __name__ == "__main__":
    cli()
