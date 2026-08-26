import { scrubSummary } from "./lib/detail-parse.js";

const t1 = "DPCC Environmental Engineer Recruitment 2026 - 17 Posts, Offline Form by 14 Sep - Govt Jobs Latest Govt Jobs UPSC Jobs SSC Jobs Railway Jobs Banking Jobs Defence Jobs Other Govt Jobs Teaching Jobs PSU Jobs More Andaman & Nicobar Andhra Pradesh";
const t2 = "BSFC Recruitment 2026 - 259 LDC - Govt Jobs Latest Govt Jobs More Bihar Chandigarh Delhi";
const t3 = "NIC Recruitment 2026 - 376 Vacancy - Govt Jobs Latest Govt Jobs More Tamil Nadu";
const clean = "DPCC Environmental Engineer Recruitment 2026 - 17 Posts, Offline Form by 14 Sep";

console.log("t1:", JSON.stringify(scrubSummary(t1)));
console.log("t2:", JSON.stringify(scrubSummary(t2)));
console.log("t3:", JSON.stringify(scrubSummary(t3)));
console.log("clean:", JSON.stringify(scrubSummary(clean)));
