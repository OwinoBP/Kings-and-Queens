const DEFAULT_FIELD_CONFIG = {
  fields: {
    propertyName: "Property Name",
    propertyNameFallback: "Name",
    location: "Location",
    price: "Price",
    type: "Type",
    status: "Status",
    description: "Description",
    businessId: "Business ID",
    photo: "Photo",
    photoBase64: "PhotoBase64"
  },
  activeStatus: "Active"
};

export default {
  async fetch(request, env) {
    const requestOrigin = request.headers.get("Origin") || "";
    const configuredOrigins = (env.ALLOWED_ORIGIN || "*")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const allowsAnyOrigin = configuredOrigins.includes("*");
    const allowedOrigin = allowsAnyOrigin
      ? "*"
      : configuredOrigins.includes(requestOrigin)
        ? requestOrigin
        : configuredOrigins[0] || "";
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=utf-8"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID || !env.AIRTABLE_TABLE_NAME) {
      return jsonResponse({
        error: "Missing Airtable configuration",
        diagnostics: {
          hasApiKey: Boolean(env.AIRTABLE_API_KEY),
          hasBaseId: Boolean(env.AIRTABLE_BASE_ID),
          hasTableName: Boolean(env.AIRTABLE_TABLE_NAME),
          allowedOrigin: env.ALLOWED_ORIGIN || null
        }
      }, 500, corsHeaders);
    }

    try {
      const requestUrl = new URL(request.url);
      const fieldConfig = parseFieldConfig(requestUrl);
      const action = (requestUrl.searchParams.get("action") || "list").trim().toLowerCase();
      const recordId = (requestUrl.searchParams.get("id") || "").trim();
      const businessId = (requestUrl.searchParams.get("businessId") || "").replace(/'/g, "\\'");
      const endpoint = new URL(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME)}`);

      if (request.method === "GET" && (action === "get" || recordId)) {
        if (!recordId) {
          return jsonResponse({ error: "Missing record id" }, 400, corsHeaders);
        }

        const recordResponse = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME)}/${recordId}`, {
          headers: { Authorization: `Bearer ${env.AIRTABLE_API_KEY}` }
        });

        if (!recordResponse.ok) {
          const errorText = await recordResponse.text();
          return jsonResponse({ error: "Unable to fetch Airtable record", details: errorText }, recordResponse.status, corsHeaders);
        }

        const record = await recordResponse.json();
        return jsonResponse({ record: sanitizeRecord(record, fieldConfig) }, 200, corsHeaders);
      }

      if (request.method === "POST") {
        const payload = await request.json().catch(() => ({}));
        const fields = buildAirtableFields(payload, fieldConfig);
        const updateRecordId = String(payload.recordId || "").trim();
        const photoBase64Field = fieldConfig.fields.photoBase64;

        let airtableResponse = updateRecordId
          ? await patchAirtableRecord(updateRecordId, env, fields)
          : await createAirtableRecord(endpoint, env, fields);
        let data = await airtableResponse.json().catch(() => ({}));

        if (!airtableResponse.ok && isFieldError(data, photoBase64Field) && fields[photoBase64Field]) {
          delete fields[photoBase64Field];
          airtableResponse = updateRecordId
            ? await patchAirtableRecord(updateRecordId, env, fields)
            : await createAirtableRecord(endpoint, env, fields);
          data = await airtableResponse.json().catch(() => ({}));
        }

        if (!airtableResponse.ok) {
          return jsonResponse({ error: updateRecordId ? "Unable to update Airtable record" : "Unable to create Airtable record", details: data }, airtableResponse.status, corsHeaders);
        }

        return jsonResponse({ recordId: data.id, record: sanitizeRecord(data, fieldConfig) }, 200, corsHeaders);
      }

      if (request.method === "GET") {
        const { fields, activeStatus } = fieldConfig;
        let filterFormula = `{${fields.status}}='${escapeFormulaValue(activeStatus)}'`;
        if (businessId) {
          filterFormula = `AND({${fields.status}}='${escapeFormulaValue(activeStatus)}', {${fields.businessId}}='${businessId}')`;
        }

        endpoint.searchParams.set("filterByFormula", filterFormula);
        const airtableResponse = await fetch(endpoint.toString(), {
          headers: {
            Authorization: `Bearer ${env.AIRTABLE_API_KEY}`
          }
        });

        if (!airtableResponse.ok) {
          const errorText = await airtableResponse.text();
          return jsonResponse({ error: "Unable to fetch Airtable records", details: errorText }, airtableResponse.status, corsHeaders);
        }

        const data = await airtableResponse.json();
        const records = Array.isArray(data.records) ? data.records : [];
        const sanitizedRecords = records.map((record) => sanitizeRecord(record, fieldConfig));
        return jsonResponse({ records: sanitizedRecords }, 200, corsHeaders);
      }

      return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
    } catch (error) {
      return jsonResponse({ error: "Unexpected worker error", details: error instanceof Error ? error.message : "Unknown error" }, 500, corsHeaders);
    }
  }
};

function parseFieldConfig(requestUrl) {
  const raw = requestUrl.searchParams.get("fieldConfig");
  if (!raw) {
    return DEFAULT_FIELD_CONFIG;
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      fields: { ...DEFAULT_FIELD_CONFIG.fields, ...(parsed.fields || {}) },
      activeStatus: parsed.activeStatus || DEFAULT_FIELD_CONFIG.activeStatus
    };
  } catch (error) {
    return DEFAULT_FIELD_CONFIG;
  }
}

function escapeFormulaValue(value) {
  return String(value || "").replace(/'/g, "\\'");
}

function createAirtableRecord(endpoint, env, fields) {
  return fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields })
  });
}

function patchAirtableRecord(recordId, env, fields) {
  return fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME)}/${recordId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields })
  });
}

function isFieldError(data, fieldName) {
  return data
    && data.error
    && String(data.error.message || "").includes(`"${fieldName}"`);
}

function buildAirtableFields(payload, fieldConfig) {
  const map = fieldConfig.fields;
  const photoUrls = Array.isArray(payload.photoUrls) ? payload.photoUrls : [];
  const priceValue = String(payload.price || "").trim();
  const numericPrice = Number(priceValue);
  const fields = {
    [map.propertyName]: payload.propertyName || "",
    [map.location]: payload.location || "",
    [map.price]: priceValue && Number.isFinite(numericPrice) ? numericPrice : "",
    [map.type]: payload.type || "House",
    [map.status]: payload.status || fieldConfig.activeStatus,
    [map.description]: payload.description || "",
    [map.businessId]: payload.businessId || "",
    [map.photo]: photoUrls.map((url) => ({ url }))
  };

  if (Array.isArray(payload.photoData) && payload.photoData.length) {
    try {
      fields[map.photoBase64] = JSON.stringify(payload.photoData.slice(0, 10));
    } catch (error) {
      // ignore stringify errors
    }
  }

  return fields;
}

function sanitizeRecord(record, fieldConfig) {
  const map = fieldConfig.fields;
  const raw = record.fields || {};
  const photo = Array.isArray(raw[map.photo])
    ? raw[map.photo]
        .filter((item) => item && item.url)
        .map((item) => ({
          url: item.url,
          cardUrl: item.thumbnails && item.thumbnails.large ? item.thumbnails.large.url : item.url,
          thumbUrl: item.thumbnails && item.thumbnails.small ? item.thumbnails.small.url : item.url
        }))
    : [];

  return {
    id: record.id,
    createdTime: record.createdTime,
    fields: {
      propertyName: raw[map.propertyName] || raw[map.propertyNameFallback] || "",
      location: raw[map.location] || "",
      price: raw[map.price] || "",
      type: raw[map.type] || "",
      status: raw[map.status] || "",
      description: raw[map.description] || "",
      businessId: raw[map.businessId] || "",
      photo,
      photoBase64: raw[map.photoBase64] || null
    }
  };
}

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}
