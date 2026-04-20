import { describe, expect, it } from "vitest";

import { parseExperienceSections } from "./parser";

const felixResumeText = `
Felix Moronge
267-468-9116 | Newark, DE | felixmftc@icloud.com | linkedin.com/in/felixmoronge | github.com/NeverEverFelix

Education
Temple University Philadelphia, PA
Bachelor of Arts in Computer Science May 2025
Experience
Product Support Engineer                                                                           Feb 2025 – Present
Wavform                                                                                                         Remote
• Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query
performance and ensuring reliable functionality for end users
• Acted as a primary point of contact for user-reported issues, clearly communicating technical findings and next steps
to both technical and non-technical stakeholders
• Instrumented PostHog and Sentry to monitor application performance and system events, enabling faster detection of
failures and more efficient root cause analysis across distributed workflows
• Partnered with engineering to translate recurring support issues into actionable system and database improvements,
reducing repeat incidents and improving overall platform stability
• Monitored application and model performance in a production environment, identifying latency and reliability issues
and contributing to improvements that increased user satisfaction by 45%
Technical Support Specialist                                                                   June 2023 – Aug 2025
Temple University Fox School of Business                                                                Philadelphia, PA
• Responded to on-call incidents, performing live triage, isolating root causes, and documenting resolutions in Jira,
Helix, and ServiceNow
• Diagnosed and resolved technical issues across hardware, software, network connectivity, and authentication systems,
ensuring minimal disruption to end users
• Resolved authentication and access issues by diagnosing Active Directory credential failures and restoring secure user
access
• Managed inbound support requests across ticketing systems, email, and in-person interactions, consistently meeting
SLA response and resolution targets
• Developed Python scripts to validate and reconcile inventory data across 2000+ systems, improving asset accuracy
and overall system reliability
• Automated data extraction and processing from BMC Remedy tickets, reducing manual reporting effort and
improving operational efficiency
Administrative Intern                                                                            Jan 2022 – Aug 2022
TUHS Department of Surgery                                                                          Philadelphia, PA
• Partnered with chief medical staff and administration to identify and implement process improvements that increased
tele-medicine appointment attendance
• Automated outreach and confirmation process, increasing patient appointment attendance by 35%
• Queried and analyzed operational data using SQL and Tableau to identify trends, support reporting, and inform
decision-making across clinical and administrative workflows

Projects
Cloud-Native Portfolio & RAG System | felixmoronge.com, TypeScript, React, Go, Python, PostgreSQL, AWS, Kubernetes
• Designed and deployed a cloud-native portfolio platform on AWS using Docker, Kubernetes, and Terraform, enabling
scalable and production-grade infrastructure
`;

describe("generate-bullets parser", () => {
  it("extracts job titles when date ranges are on the same line and stops before projects", () => {
    const sections = parseExperienceSections(felixResumeText);

    expect(sections.map((section) => section.title)).toEqual([
      "Product Support Engineer",
      "Technical Support Specialist",
      "Administrative Intern",
    ]);
    expect(sections[0]?.header_lines).toEqual([
      "Product Support Engineer                                                                           Feb 2025 – Present",
      "Wavform                                                                                                         Remote",
    ]);
    expect(sections[0]?.bullets).toHaveLength(5);
    expect(sections[1]?.bullets).toHaveLength(6);
    expect(sections[2]?.bullets).toHaveLength(3);
    expect(sections.some((section) => section.title.includes("Cloud-Native Portfolio"))).toBe(false);
    expect(sections.some((section) => section.title.includes("Wavform"))).toBe(false);
  });
});
