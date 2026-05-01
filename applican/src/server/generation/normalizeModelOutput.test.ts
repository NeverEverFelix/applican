import { describe, expect, it } from "vitest";

import { normalizeModelOutput } from "./normalizeModelOutput.ts";

const PARSER_DEBUG = {
  experience_header_found: true,
  section_count: 1,
  experience_slice_preview: ["Product Support Engineer"],
  source_experience_sections: [
    {
      title: "Product Support Engineer",
      bullets: [
        "Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users",
      ],
      header_lines: ["Product Support Engineer"],
    },
  ],
};

describe("normalizeModelOutput", () => {
  it("builds optimization_sections from reconciled experience optimizations instead of raw model order", () => {
    const output = normalizeModelOutput({
      raw: {
        company: "Acme",
        title: "Support Engineer",
        strengths: ["A", "B", "C"],
        gaps: ["X", "Y"],
        match_score: 82,
        match_summary: "Strong support alignment.",
        selected_skills: [],
        optimizations: [
          {
            experience_title: "Product Support Engineer",
            bullets: [
              {
                action: "replace",
                original:
                  "Acted as a primary point of contact for user-reported issues, clearly communicating technical findings and next steps to both technical and non-technical stakeholders",
                rewritten:
                  "Served as primary liaison for technical issue resolution, communicating effectively with cross-functional teams",
              },
            ],
          },
          {
            experience_title: "Technical Support Specialist",
            bullets: [
              {
                action: "replace",
                original:
                  "Managed high-volume support requests across ticketing systems, email, and in-person channels, consistently meeting SLA response and resolution targets",
                rewritten:
                  "Managed high-volume support requests across ticketing, email, and in-person channels while consistently meeting SLA response and resolution targets",
              },
            ],
          },
        ],
        experience_rewrites: [
          {
            title: "Product Support Engineer",
            company: "Wavform",
            bullets: [
              "Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
              "Served as primary liaison for technical issue resolution, communicating effectively with cross-functional teams",
            ],
          },
          {
            title: "Technical Support Specialist",
            company: "Temple University",
            bullets: [
              "Managed high-volume support requests across ticketing, email, and in-person channels while consistently meeting SLA response and resolution targets",
            ],
          },
        ],
        projects_rewrites: [],
        project_optimizations: [],
      },
      model: "gpt-4.1",
      requestId: "request-1",
      parsedSourceExperienceSections: [
        {
          title: "Product Support Engineer",
          bullets: [
            "Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users",
            "Acted as a primary point of contact for user-reported issues, clearly communicating technical findings and next steps to both technical and non-technical stakeholders",
          ],
        },
        {
          title: "Technical Support Specialist",
          bullets: [
            "Managed high-volume support requests across ticketing systems, email, and in-person channels, consistently meeting SLA response and resolution targets",
          ],
        },
      ],
      parserDebug: PARSER_DEBUG,
    });

    expect(output.optimization_sections).toEqual([
      {
        id: "exp:0",
        kind: "experience",
        source_index: 0,
        display_title: "Product Support Engineer",
        bullets: [
          {
            id: "exp:0:0",
            source_index: 0,
            original:
              "Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users",
            optimized:
              "Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
            action: "replace",
          },
          {
            id: "exp:0:1",
            source_index: 1,
            original:
              "Acted as a primary point of contact for user-reported issues, clearly communicating technical findings and next steps to both technical and non-technical stakeholders",
            optimized:
              "Served as primary liaison for technical issue resolution, communicating effectively with cross-functional teams",
            action: "replace",
          },
        ],
      },
      {
        id: "exp:1",
        kind: "experience",
        source_index: 1,
        display_title: "Technical Support Specialist",
        bullets: [
          {
            id: "exp:1:0",
            source_index: 0,
            original:
              "Managed high-volume support requests across ticketing systems, email, and in-person channels, consistently meeting SLA response and resolution targets",
            optimized:
              "Managed high-volume support requests across ticketing, email, and in-person channels while consistently meeting SLA response and resolution targets",
            action: "replace",
          },
        ],
      },
    ]);
  });

  it("prefers experience rewrites when an optimization rewritten bullet is unchanged from the source", () => {
    const output = normalizeModelOutput({
      raw: {
        company: "Acme",
        title: "Support Engineer",
        strengths: ["A", "B", "C"],
        gaps: ["X", "Y"],
        match_score: 82,
        match_summary: "Strong support alignment.",
        selected_skills: [],
        optimizations: [
          {
            experience_title: "Technical Support Specialist",
            bullets: [
              {
                action: "replace",
                original:
                  "Managed high-volume support requests across ticketing systems, email, and in-person channels, consistently meeting SLA response and resolution targets",
                rewritten:
                  "Managed high-volume support requests across ticketing systems, email, and in-person channels, consistently meeting SLA response and resolution targets",
              },
            ],
          },
        ],
        experience_rewrites: [
          {
            title: "Technical Support Specialist",
            company: "Temple University",
            bullets: [
              "Managed high-volume support requests across ticketing, email, and in-person channels while consistently meeting SLA response and resolution targets",
            ],
          },
        ],
        projects_rewrites: [],
        project_optimizations: [],
      },
      model: "gpt-4.1",
      requestId: "request-2",
      parsedSourceExperienceSections: [
        {
          title: "Technical Support Specialist",
          bullets: [
            "Managed high-volume support requests across ticketing systems, email, and in-person channels, consistently meeting SLA response and resolution targets",
          ],
        },
      ],
      parserDebug: PARSER_DEBUG,
    });

    expect(output.optimizations[0]?.bullets[0]?.rewritten).toBe(
      "Managed high-volume support requests across ticketing, email, and in-person channels while consistently meeting SLA response and resolution targets",
    );
    expect(output.optimization_sections[0]?.bullets[0]?.optimized).toBe(
      "Managed high-volume support requests across ticketing, email, and in-person channels while consistently meeting SLA response and resolution targets",
    );
  });
});
