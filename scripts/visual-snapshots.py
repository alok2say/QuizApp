#!/usr/bin/env python3
"""Capture every page as screenshots and compare two runs pixel by pixel.

Use it before and after a structural or visual change:

    python3 scripts/visual-snapshots.py capture baseline
    ...make the change...
    python3 scripts/visual-snapshots.py capture after
    python3 scripts/visual-snapshots.py compare baseline after

Needs the dev server on SNAP_BASE_URL (default http://localhost:3000),
Python Playwright and Pillow. Logged-in pages need SNAP_USER_EMAIL and
SNAP_USER_PASSWORD; admin pages need SNAP_ADMIN_EMAIL and
SNAP_ADMIN_PASSWORD (can be the same account). Optional: SNAP_QUIZ_ID,
SNAP_TAKE_URL, SNAP_RESULT_URL. Pages whose env vars are unset are
skipped. Credentials are read from the environment only.

While capturing, every non-GET request to /api/ except login is aborted,
so opening a take page whose time is up can't submit the attempt.
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / ".snapshots"
BASE = os.environ.get("SNAP_BASE_URL", "http://localhost:3000").rstrip("/")
SCHEMES = ["light", "dark"]
WIDTHS = [1280, 360]
# Content that changes between runs on its own
MASKS = ["pdf-reader", '[aria-label^="Time left"]']


def env(name):
    value = os.environ.get(name)
    return value if value else None


def pages():
    quiz = env("SNAP_QUIZ_ID")
    take = env("SNAP_TAKE_URL")
    result = env("SNAP_RESULT_URL")
    listed = [
        ("home", "/", None),
        ("login", "/login", None),
        ("login-created", "/login?created=1", None),
        ("signup", "/signup", None),
        ("library", "/library", None),
        ("library-doc", "/library/cardiology-chap-2", None),
        ("design", "/design", None),
        ("quizzes", "/quizzes", "user"),
        ("leaderboard", f"/quizzes/{quiz}/leaderboard" if quiz else None, "user"),
        ("result", result, "user"),
        ("take", take, "user"),
        ("admin-list", "/admin/quizzes", "admin"),
        ("admin-new", "/admin/quizzes/new", "admin"),
        ("admin-edit", f"/admin/quizzes/{quiz}/edit" if quiz else None, "admin"),
    ]
    return listed


# Interactive states that full-page captures miss: (name, path, role, action)
FOCUSED = [
    ("login-focus", "/login", None, "tab"),
    ("take-checked", env("SNAP_TAKE_URL"), "user", "check"),
]


def credentials(role):
    if role is None:
        return None
    prefix = "SNAP_ADMIN" if role == "admin" else "SNAP_USER"
    email, password = env(f"{prefix}_EMAIL"), env(f"{prefix}_PASSWORD")
    return (email, password) if email and password else None


def guard_writes(route, request):
    if request.method != "GET" and "/api/" in request.url and "/api/auth/" not in request.url:
        route.abort()
    else:
        route.continue_()


def log_in(page, creds):
    page.goto(f"{BASE}/login")
    page.get_by_label("Email").fill(creds[0])
    page.get_by_label("Password").fill(creds[1])
    page.get_by_role("button", name="Log in").click()
    page.wait_for_url(lambda url: "/login" not in url, timeout=15000)


def settle(page):
    page.wait_for_load_state("networkidle")
    page.evaluate("document.fonts.ready")
    # Next's dev overlay badge shows request errors (e.g. the aborted submit)
    page.add_style_tag(content="nextjs-portal { display: none !important; }")


def capture(name):
    from playwright.sync_api import sync_playwright

    target = OUT / name
    target.mkdir(parents=True, exist_ok=True)
    jobs = [(n, p, r, None) for n, p, r in pages()] + list(FOCUSED)

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for role in [None, "user", "admin"]:
            creds = credentials(role)
            role_jobs = [j for j in jobs if j[2] == role]
            if role is not None and creds is None:
                for job in role_jobs:
                    print(f"skipped {job[0]} (no {role} credentials)")
                continue
            for scheme in SCHEMES:
                for width in WIDTHS:
                    context = browser.new_context(
                        viewport={"width": width, "height": 900},
                        color_scheme=scheme,
                        reduced_motion="reduce",
                    )
                    context.route("**/*", guard_writes)
                    page = context.new_page()
                    if creds:
                        log_in(page, creds)
                    for page_name, path, _, action in role_jobs:
                        if path is None:
                            if scheme == SCHEMES[0] and width == WIDTHS[0]:
                                print(f"skipped {page_name} (no URL in env)")
                            continue
                        response = page.goto(f"{BASE}{path}")
                        if response is not None and response.status == 404:
                            if scheme == SCHEMES[0] and width == WIDTHS[0]:
                                print(f"skipped {page_name} (404)")
                            continue
                        settle(page)
                        if action == "tab":
                            page.keyboard.press("Tab")
                            page.keyboard.press("Tab")
                        elif action == "check":
                            page.locator("label:has(input)").first.click(timeout=5000)
                        masks = [page.locator(selector) for selector in MASKS]
                        page.screenshot(
                            path=str(target / f"{page_name}-{scheme}-{width}.png"),
                            full_page=action is None,
                            mask=masks,
                            animations="disabled",
                            caret="hide",
                        )
                    context.close()
        browser.close()
    print(f"captured {len(list(target.glob('*.png')))} files in {target}")


def compare(a, b):
    from PIL import Image, ImageChops

    dir_a, dir_b = OUT / a, OUT / b
    names = sorted({p.name for p in dir_a.glob("*.png")} | {p.name for p in dir_b.glob("*.png")})
    failed = False
    for file_name in names:
        path_a, path_b = dir_a / file_name, dir_b / file_name
        if not path_a.exists() or not path_b.exists():
            print(f"{file_name}: missing in {a if not path_a.exists() else b}")
            failed = True
            continue
        img_a = Image.open(path_a).convert("RGB")
        img_b = Image.open(path_b).convert("RGB")
        if img_a.size != img_b.size:
            print(f"{file_name}: size {img_a.size} vs {img_b.size}")
            failed = True
            continue
        diff = ImageChops.difference(img_a, img_b)
        box = diff.getbbox()
        count = 0
        if box:
            count = sum(1 for px in diff.convert("L").point(lambda p: 255 if p > 0 else 0).getdata() if px)
            failed = True
        print(f"{file_name}: {count} px differ" + (f" in {box}" if box else ""))
    return 1 if failed else 0


def main():
    if len(sys.argv) == 3 and sys.argv[1] == "capture":
        capture(sys.argv[2])
        return 0
    if len(sys.argv) == 4 and sys.argv[1] == "compare":
        return compare(sys.argv[2], sys.argv[3])
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())
