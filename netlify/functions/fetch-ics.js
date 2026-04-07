// Netlify serverless function: proxies an ICS calendar fetch to avoid CORS issues.
// Usage: /.netlify/functions/fetch-ics?url=<encoded-webcal-or-https-url>

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const calendarUrl = event.queryStringParameters && event.queryStringParameters.url;

  if (!calendarUrl) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing 'url' query parameter" }),
    };
  }

  // Normalize webcal:// to https://
  const fetchUrl = calendarUrl.replace(/^webcal:\/\//, "https://");

  // Basic URL validation
  try {
    new URL(fetchUrl);
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid URL" }),
    };
  }

  try {
    const response = await fetch(fetchUrl, {
      headers: {
        "User-Agent": "LineupDJ/1.0",
        Accept: "text/calendar, text/plain, */*",
      },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: `Calendar server returned ${response.status}`,
        }),
      };
    }

    const icsText = await response.text();

    // Quick sanity check that it looks like an ICS file
    if (!icsText.includes("BEGIN:VCALENDAR")) {
      return {
        statusCode: 422,
        headers,
        body: JSON.stringify({
          error: "Response does not appear to be a valid ICS calendar",
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Cache-Control": "public, max-age=300", // cache 5 min
      },
      body: JSON.stringify({ ics: icsText }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        error: "Failed to fetch calendar: " + err.message,
      }),
    };
  }
};
