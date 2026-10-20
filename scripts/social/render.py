"""Render a post kit's card.html to card.png (1080x1350).

    python3 scripts/social/render.py <outDir>
"""
import asyncio
import pathlib
import sys

from playwright.async_api import async_playwright


async def main(out: pathlib.Path) -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1080, "height": 1350}, device_scale_factor=1)
        await page.goto((out / "card.html").resolve().as_uri())
        await page.evaluate("document.fonts.ready")
        await page.wait_for_timeout(300)
        await page.screenshot(path=str(out / "card.png"))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main(pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "post-kit")))
