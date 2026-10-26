import os
import re

import frappe

no_cache = 1
no_breadcrumbs = 1
no_sitemap = 1

_SCRIPT_RE = re.compile(r'<script[^>]+type="module"[^>]+src="([^"]+)"')
_CSS_RE = re.compile(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"')
_cache = {"mtime": None, "js": [], "css": []}


def _bundle():
	"""Entry JS/CSS filenames from the Vite-built index.html.

	Vite content-hashes the entry (index-<hash>.js), and lazily loaded page
	chunks import that exact URL — so the shell must reference the very same
	filename. No ?v= query: a query would make it a different module URL from
	the one the chunks import, and the app would boot twice.
	"""
	path = frappe.get_app_path("pranera_sample", "public", "sample_app", "index.html")
	try:
		mtime = os.path.getmtime(path)
	except OSError:
		return [], []
	if _cache["mtime"] != mtime:
		html = open(path, encoding="utf-8").read()
		_cache.update(mtime=mtime, js=_SCRIPT_RE.findall(html), css=_CSS_RE.findall(html))
	return _cache["js"], _cache["css"]


def get_context(context):
	"""Serves the Sample Pass SPA shell, with csrf_token injected so the
	Vue app's POST calls work on first load."""
	context.no_cache = 1
	context.csrf_token = frappe.sessions.get_csrf_token()
	context.entry_js, context.entry_css = _bundle()
