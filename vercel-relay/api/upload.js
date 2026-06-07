// Vercel Function: Supabase Upload Relay
// Receives business data from CCR and uploads to Supabase (bypasses IP allowlist issue)

const SUPABASE_URL = "https://mcsygsqfyuaexxxwsgem.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jc3lnc3FmeXVhZXh4eHdzZ2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1Njk1MTIsImV4cCI6MjA5NDE0NTUxMn0.Hu6t2PLjE_D113NMQEGvEv8QGhqN6udKNO9McqK3ST8";

const HEADERS = {
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "apikey": SUPABASE_KEY,
  "Content-Type": "application/json",
};

async function getExistingBusinesses() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/businesses?select=name,address`, {
    method: "GET",
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`Failed to fetch existing businesses: ${res.statusText}`);
  return res.json();
}

async function createUploadSession(sessionData) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/upload_sessions`, {
    method: "POST",
    headers: { ...HEADERS, "Prefer": "return=minimal" },
    body: JSON.stringify(sessionData),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.statusText}`);
  return res.json();
}

async function uploadBusinessesBatch(records) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/businesses`, {
    method: "POST",
    headers: { ...HEADERS, "Prefer": "return=minimal" },
    body: JSON.stringify(records),
  });
  if (!res.ok) throw new Error(`Batch upload failed: ${res.statusText}`);
  return res.json();
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { session_id, file_name, businesses, upload_date, status_counts } = req.body;

    // Validate request
    if (!session_id || !businesses || !Array.isArray(businesses)) {
      return res.status(400).json({
        error: "Invalid request: session_id and businesses array required",
      });
    }

    console.log(`[${session_id}] Processing ${businesses.length} businesses from ${file_name}`);

    // Step 1: Fetch existing businesses for deduplication
    let existingKeys = new Set();
    try {
      const existing = await getExistingBusinesses();
      existingKeys = new Set(existing.map(b => `${b.name}|${b.address}`));
      console.log(`[${session_id}] Found ${existingKeys.size} existing businesses`);
    } catch (err) {
      console.warn(`[${session_id}] Could not fetch existing businesses (dedup will be skipped):`, err.message);
    }

    // Step 2: Filter out duplicates
    const newBusinesses = businesses.filter(b => !existingKeys.has(`${b.name}|${b.address}`));
    const duplicateCount = businesses.length - newBusinesses.length;

    console.log(`[${session_id}] New: ${newBusinesses.length}, Duplicates: ${duplicateCount}`);

    if (newBusinesses.length === 0) {
      console.log(`[${session_id}] All records are duplicates, skipping upload`);
      return res.status(200).json({
        status: "skipped",
        session_id,
        message: "All records already exist",
        uploaded: 0,
        skipped: duplicateCount,
      });
    }

    // Step 3: Create upload_sessions record
    const sessionPayload = {
      id: session_id,
      file_name,
      upload_date,
      total_count: newBusinesses.length,
      suspicious_count: status_counts?.suspicious || 0,
      ok_count: status_counts?.ok || 0,
      unknown_count: status_counts?.unknown || 0,
      skipped_count: duplicateCount,
      business_ids: [],
    };

    await createUploadSession(sessionPayload);
    console.log(`[${session_id}] Created upload session`);

    // Step 4: Upload businesses in batches
    const batchSize = 50;
    let uploadedCount = 0;
    const insertedIds = [];

    for (let i = 0; i < newBusinesses.length; i += batchSize) {
      const batch = newBusinesses.slice(i, i + batchSize);
      const batchWithSession = batch.map(b => ({
        ...b,
        upload_session_id: session_id,
      }));

      try {
        await uploadBusinessesBatch(batchWithSession);
        uploadedCount += batch.length;
        batch.forEach(b => insertedIds.push(b.id));
        console.log(`[${session_id}] Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records uploaded`);
      } catch (err) {
        console.error(`[${session_id}] Batch upload failed:`, err.message);
        return res.status(500).json({
          error: `Batch upload failed at position ${i}`,
          detail: err.message,
          uploaded: uploadedCount,
        });
      }
    }

    console.log(`[${session_id}] All batches completed. Total uploaded: ${uploadedCount}`);

    return res.status(200).json({
      status: "success",
      session_id,
      uploaded: uploadedCount,
      skipped: duplicateCount,
      file_name,
      message: `Successfully uploaded ${uploadedCount} new businesses (${duplicateCount} duplicates skipped)`,
    });

  } catch (error) {
    console.error("Relay error:", error);
    return res.status(500).json({ error: error.message });
  }
}
