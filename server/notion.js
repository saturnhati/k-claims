import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const NOTION_VERSION = '2022-06-28';
const API = 'https://api.notion.com/v1';

function readFromShell(name) {
  const home = os.homedir();
  const files = ['.zshenv', '.zshrc', '.zprofile', '.bash_profile', '.bashrc', '.profile'];
  const re = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*["']?([^"'\n]+)["']?\\s*$`, 'm');
  for (const f of files) {
    const p = path.join(home, f);
    try {
      const content = fs.readFileSync(p, 'utf8');
      const m = content.match(re);
      if (m) return m[1].trim();
    } catch {
      // file non esistente, continua
    }
  }
  return null;
}

export function getToken() {
  if (process.env.NOTION_TOKEN) return process.env.NOTION_TOKEN.trim();
  return readFromShell('NOTION_TOKEN');
}

export function getDbId() {
  if (process.env.NOTION_DB_ID) return process.env.NOTION_DB_ID.trim();
  return readFromShell('NOTION_DB_ID');
}

async function notion(method, urlPath, body) {
  const token = getToken();
  if (!token) {
    const err = new Error('NOTION_TOKEN non trovato. Aggiungilo a ~/.zshenv o nell\'ambiente.');
    err.statusCode = 500;
    throw err;
  }
  const res = await fetch(API + urlPath, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    const err = new Error(data.message || `Errore Notion ${res.status}`);
    err.statusCode = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

export async function getDatabase(dbId) {
  return notion('GET', `/databases/${dbId}`);
}

export async function createDatabase(parentPageId, title, properties) {
  return notion('POST', '/databases', {
    parent: { page_id: parentPageId },
    title: [{ type: 'text', text: { content: title } }],
    properties,
  });
}

export async function queryDatabaseAll(dbId) {
  const rows = [];
  let cursor = undefined;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const data = await notion('POST', `/databases/${dbId}/query`, body);
    rows.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return rows;
}

export async function createPage(dbId, properties) {
  return notion('POST', '/pages', {
    parent: { database_id: dbId },
    properties,
  });
}

export async function updatePage(pageId, properties) {
  return notion('PATCH', `/pages/${pageId}`, { properties });
}

export async function archivePage(pageId) {
  return notion('DELETE', `/blocks/${pageId}`);
}
