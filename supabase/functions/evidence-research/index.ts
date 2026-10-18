import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const supabaseURL = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=120",
  "x-content-type-options": "nosniff",
};
const stop = new Set(["what","where","when","why","who","which","would","could","should","about","does","have","with","from","that","this","there","they","them","these","those","were","been","into","some","tell","find","show","give","did","the","and","for","are","was","had","how","can","has","its","any","our","all"]);

const norm = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (v: string) => [...new Set(norm(v).split(" ").filter(w => w.length > 2 && !stop.has(w)).slice(0,16))];
function score(q: string, parts: [unknown, number][]) {
  const words = tokens(q);
  if (!words.length) return 0;
  let total = 0;
  for (const [raw, weight] of parts) {
    const body = " " + norm(raw) + " ";
    if (body.length < 3) continue;
    if (body.includes(" " + norm(q) + " ")) total += weight * 4;
    for (const word of words) {
      if (body.includes(" " + word + " ")) total += weight * 2;
      else if (body.includes(word)) total += weight * .4;
    }
  }
  return total;
}
async function publicRecords(table: string, select: string, order: string) {
  const u = new URL(supabaseURL + "/rest/v1/" + table);
  u.searchParams.set("select", select);
  u.searchParams.set("published", "eq.true");
  u.searchParams.set("order", order);
  u.searchParams.set("limit", "500");
  const response = await fetch(u, {headers: {apikey: anonKey, accept: "application/json"}, signal: AbortSignal.timeout(9500)});
  if (!response.ok) throw new Error("Public evidence data unavailable");
  return await response.json() as Record<string, unknown>[];
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: cors});
  if (request.method !== "GET") return Response.json({error:"GET only"}, {status:405, headers:cors});
  const url = new URL(request.url);
  const question = (url.searchParams.get("q") ?? "").trim();
  if (question.length < 3 || question.length > 160) {
    return Response.json({error:"Enter a research question of 3 to 160 characters."}, {status:400, headers:cors});
  }
  if (!supabaseURL || !anonKey) {
    return Response.json({error:"Public research database unavailable."}, {status:503, headers:cors});
  }
  try {
    const [cases, sources, problems] = await Promise.all([
      publicRecords("cases", "id,case_number,title,slug,summary,category,evidence_level,claim_grade,official_finding,disputed_questions", "case_number.asc"),
      publicRecords("sources", "id,title,publisher,publication_date,source_type,url,archive_url,credibility_tier,public_notes", "id.asc"),
      publicRecords("problem_areas", "id,name,description,goal,urgency", "id.asc"),
    ]);
    const find = (input: Record<string, unknown>[], fields: [string, number][], limit: number) =>
      input.map(record => ({record, relevance: score(question, fields.map(([field, weight]) => [record[field], weight] as [unknown,number]))}))
        .filter(row => row.relevance > 0)
        .sort((a,b) => b.relevance - a.relevance)
        .slice(0,limit)
        .map(({record})=>record);

    const casesFound = find(cases, [["title",7],["summary",3],["category",2],["official_finding",2],["disputed_questions",1]], 8);
    const documents = find(sources, [["title",7],["publisher",3],["public_notes",1],["source_type",1]], 6);
    const goals = find(problems, [["name",6],["description",3],["goal",2]], 4);
    return Response.json({
      question,
      mode:"public_evidence_keyword_retrieval",
      ai_generation:false,
      matches: {
        cases: casesFound,
        documents,
        problem_areas: goals
      },
      totals: {published_cases:cases.length, published_sources:sources.length, public_problem_areas:problems.length},
      method:"Matches are ranked by terms found in published titles, summaries and research notes. A source matching the same question is not automatically linked to a case.",
      next_steps:[
        "Read the case's official finding and disputed questions separately.",
        "Open each source and check its author, date, primary evidence and context.",
        "Look for independent corroboration and evidence that could contradict the claim.",
        "Treat unexplained gaps as unanswered questions, not proof of a theory.",
        "Use the Solutions area to propose measurable next steps."
      ],
      warning:"Search relevance is not proof, verification, causation, or an allegation of wrongdoing. Unpublished working drafts are not included.",
    }, {headers:cors});
  } catch (error) {
    console.error("evidence-research failed:", error instanceof Error ? error.message : "unavailable");
    return Response.json({error:"Public evidence search is temporarily unavailable."}, {status:503, headers:{...cors, "cache-control":"no-store"}});
  }
});
