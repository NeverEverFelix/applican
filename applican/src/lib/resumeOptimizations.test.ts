import { describe, expect, it } from "vitest";

import {
  cleanOptimizationSectionTitle,
  deriveSourceExperienceSectionsFromOptimizations,
  extractResumeOptimizationPresentationSections,
  extractOriginalBulletSections,
} from "./resumeOptimizations";

const malformedResumeStudioOutput = {
  optimizations: [
    {
      bullets: [
        {
          action: "replace",
          reason: "More concise and ATS-friendly with focus on impact",
          original:
            "Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users",
          rewritten:
            "Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
        },
        {
          action: "replace",
          reason: "Improves clarity and ATS keyword usage",
          original:
            "Acted as a primary point of contact for user-reported issues, clearly communicating technical findings and next steps to both technical and non-technical stakeholders",
          rewritten:
            "Served as primary liaison for technical issue resolution, communicating effectively with cross-functional teams",
        },
      ],
      role_after:
        "- Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability\n- Served as primary liaison for technical issue resolution, communicating effectively with cross-functional teams",
      role_before:
        "- Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users\n- Acted as a primary point of contact for user-reported issues, clearly communicating technical findings and next steps to both technical and non-technical stakeholders",
      experience_title: "Product Support Engineer at Wavform",
    },
  ],
  tailored_resume_input: {
    experience_rewrites: [
      {
        title: "Product Support Engineer",
        bullets: [
          "Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
          "Served as primary liaison for technical issue resolution, communicating effectively with cross-functional teams",
        ],
        company: "Wavform",
      },
      {
        title: "Technical Support Specialist",
        bullets: [
          "Responded to on-call incidents, performing live triage and root cause analysis using Jira, Helix, and ServiceNow",
          "Diagnosed and resolved hardware, software, network, and authentication issues to minimize user disruption",
          "Resolved Active Directory credential failures to restore secure user access",
          "Managed inbound support requests across multiple channels, consistently meeting SLA targets",
        ],
        company: "Temple University Fox School of Business",
      },
      {
        title: "Administrative Intern",
        bullets: [
          "Partnered with medical staff to implement process improvements increasing telemedicine appointment attendance by 35%",
          "Automated outreach and confirmation processes to boost patient appointment attendance",
          "Queried and analyzed operational data using SQL and Tableau to support reporting and decision-making",
        ],
        company: "TUHS Department of Surgery",
      },
    ],
  },
  source_experience_sections: [],
};

describe("resumeOptimizations", () => {
  it("normalizes malformed section titles into stable role titles", () => {
    expect(cleanOptimizationSectionTitle("Product Support Engineer at Wavform")).toBe(
      "Product Support Engineer",
    );
    expect(cleanOptimizationSectionTitle("Product Support EngineerFeb")).toBe(
      "Product Support Engineer   Feb",
    );
    expect(cleanOptimizationSectionTitle("Technical Support SpecialistJune 2023 – Aug 2025")).toBe(
      "Technical Support Specialist   June 2023 – Aug 2025",
    );

    expect(
      cleanOptimizationSectionTitle(
        "- Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
      ),
    ).toBe("");
  });

  it("prefers optimization sections over fallback rewrites when titles are fuzzy matches", () => {
    const sections = extractOriginalBulletSections(malformedResumeStudioOutput);

    expect(sections).toHaveLength(3);
    expect(sections[0]?.title).toBe("Product Support Engineer");
    expect(sections[0]?.bullets).toHaveLength(2);
    expect(sections[0]?.bullets[0]).toEqual({
      action: "replace",
      original:
        "Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users",
      rewritten:
        "Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
    });
    expect(sections[1]?.title).toBe("Technical Support Specialist");
    expect(sections[1]?.bullets).toHaveLength(4);
    expect(sections[1]?.bullets[0]?.original).toBe(
      "Responded to on-call incidents, performing live triage and root cause analysis using Jira, Helix, and ServiceNow",
    );
    expect(sections[2]?.title).toBe("Administrative Intern");
    expect(sections[2]?.bullets).toHaveLength(3);
  });

  it("preserves unoptimized bullets when a matched optimization section only rewrites one bullet", () => {
    const sections = extractOriginalBulletSections({
      ...malformedResumeStudioOutput,
      optimizations: [
        {
          ...malformedResumeStudioOutput.optimizations[0],
          bullets: [malformedResumeStudioOutput.optimizations[0].bullets[0]],
        },
      ],
    });

    expect(sections[0]?.title).toBe("Product Support Engineer");
    expect(sections[0]?.bullets).toHaveLength(2);
    expect(sections[0]?.bullets[0]?.rewritten).toBe(
      "Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
    );
    expect(sections[0]?.bullets[1]?.rewritten).toBe(
      "Served as primary liaison for technical issue resolution, communicating effectively with cross-functional teams",
    );
  });

  it("does not duplicate roles when matched titles differ only by company suffix", () => {
    const sections = extractOriginalBulletSections({
      optimizations: malformedResumeStudioOutput.optimizations,
      tailored_resume_input: {
        experience_rewrites: [
          {
            title: "Product Support Engineer at Wavform",
            bullets: malformedResumeStudioOutput.tailored_resume_input.experience_rewrites[0].bullets,
            company: "Wavform",
          },
          ...malformedResumeStudioOutput.tailored_resume_input.experience_rewrites.slice(1),
        ],
      },
      source_experience_sections: [],
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Product Support Engineer",
      "Technical Support Specialist",
      "Administrative Intern",
    ]);
  });

  it("derives source experience sections from optimization originals when parser output is empty", () => {
    const sourceSections = deriveSourceExperienceSectionsFromOptimizations(
      malformedResumeStudioOutput.optimizations,
    );

    expect(sourceSections).toEqual([
      {
        title: "Product Support Engineer",
        bullets: [
          "Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users",
          "Acted as a primary point of contact for user-reported issues, clearly communicating technical findings and next steps to both technical and non-technical stakeholders",
        ],
      },
    ]);
  });

  it("builds strict presentation sections by source index without duplicating or dropping roles", () => {
    const sections = extractResumeOptimizationPresentationSections({
      ...malformedResumeStudioOutput,
      source_experience_sections: [
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
            "Responded to on-call incidents, performing live triage and root cause analysis using Jira, Helix, and ServiceNow",
            "Diagnosed and resolved hardware, software, network, and authentication issues to minimize user disruption",
          ],
        },
        {
          title: "Administrative Intern",
          bullets: [
            "Partnered with medical staff to implement process improvements increasing telemedicine appointment attendance by 35%",
          ],
        },
      ],
      project_optimizations: [
        {
          name: "Support Dashboard",
          bullets: [
            {
              action: "replace",
              original: "Built internal reporting dashboard",
              rewritten: "Built an internal reporting dashboard that reduced support triage time by 18%",
            },
          ],
        },
      ],
      tailored_resume_input: {
        ...malformedResumeStudioOutput.tailored_resume_input,
        projects_rewrites: [
          {
            name: "Support Dashboard",
            bullets: ["Built an internal reporting dashboard that reduced support triage time by 18%"],
          },
        ],
      },
    });

    expect(sections.map((section) => `${section.kind}:${section.display_title}`)).toEqual([
      "experience:Product Support Engineer",
      "experience:Technical Support Specialist",
      "experience:Administrative Intern",
      "project:Support Dashboard",
    ]);

    expect(sections[0]?.bullets).toEqual([
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
    ]);

    expect(sections[1]?.bullets[0]).toEqual({
      id: "exp:1:0",
      source_index: 0,
      original:
        "Responded to on-call incidents, performing live triage and root cause analysis using Jira, Helix, and ServiceNow",
      optimized:
        "Responded to on-call incidents, performing live triage and root cause analysis using Jira, Helix, and ServiceNow",
      action: "replace",
    });

    expect(sections[2]?.bullets).toHaveLength(1);
    expect(sections[3]?.bullets[0]).toEqual({
      id: "proj:0:0",
      source_index: 0,
      original: "Built internal reporting dashboard",
      optimized: "Built an internal reporting dashboard that reduced support triage time by 18%",
      action: "replace",
    });
  });

  it("prefers source experience titles over malformed model titles in the presentation model", () => {
    const sections = extractResumeOptimizationPresentationSections({
      source_experience_sections: [
        {
          title: "Product Support Engineer",
          bullets: [
            "Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users",
          ],
        },
      ],
      optimizations: [
        {
          experience_title: "Wavform Remote",
          role_before:
            "- Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users",
          role_after:
            "- Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
          bullets: [
            {
              action: "replace",
              original:
                "Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users",
              rewritten:
                "Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
            },
          ],
        },
      ],
      tailored_resume_input: {
        experience_rewrites: [
          {
            title: "Wavform Remote",
            bullets: [
              "Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
            ],
          },
        ],
        projects_rewrites: [],
      },
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.display_title).toBe("Product Support Engineer");
    expect(sections[0]?.bullets[0]).toEqual({
      id: "exp:0:0",
      source_index: 0,
      original:
        "Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users",
      optimized:
        "Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
      action: "replace",
    });
  });

  it("does not overwrite a source bullet when the optimization original belongs to a different bullet", () => {
    const sections = extractResumeOptimizationPresentationSections({
      source_experience_sections: [
        {
          title: "Product Support Engineer",
          bullets: [
            "Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users",
            "Acted as a primary point of contact for user-reported issues, clearly communicating technical findings and next steps to both technical and non-technical stakeholders",
          ],
        },
      ],
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
      ],
      tailored_resume_input: {
        experience_rewrites: [
          {
            title: "Product Support Engineer",
            bullets: [
              "Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
              "Served as primary liaison for technical issue resolution, communicating effectively with cross-functional teams",
            ],
          },
        ],
        projects_rewrites: [],
      },
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.bullets).toEqual([
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
    ]);
  });

  it("prefers backend optimization_sections over local derivation when present", () => {
    const sections = extractResumeOptimizationPresentationSections({
      optimization_sections: [
        {
          id: "exp:0",
          kind: "experience",
          source_index: 0,
          display_title: "Canonical Backend Title",
          bullets: [
            {
              id: "exp:0:0",
              source_index: 0,
              original: "Original from backend",
              optimized: "Optimized from backend",
              action: "replace",
            },
          ],
        },
      ],
      source_experience_sections: [
        {
          title: "Source Title That Should Not Win",
          bullets: ["Source bullet"],
        },
      ],
      tailored_resume_input: {
        experience_rewrites: [
          {
            title: "Rewrite Title That Should Not Win",
            bullets: ["Rewrite bullet"],
          },
        ],
        projects_rewrites: [],
      },
    });

    expect(sections).toEqual([
      {
        id: "exp:0",
        kind: "experience",
        source_index: 0,
        display_title: "Canonical Backend Title",
        bullets: [
          {
            id: "exp:0:0",
            source_index: 0,
            original: "Original from backend",
            optimized: "Optimized from backend",
            action: "replace",
          },
        ],
      },
    ]);
  });

  it("falls back to local derivation when optimization_sections is malformed", () => {
    const sections = extractResumeOptimizationPresentationSections({
      optimization_sections: [
        {
          id: "exp:0",
          kind: "experience",
          source_index: 0,
          display_title: "",
          bullets: [],
        },
      ],
      source_experience_sections: [
        {
          title: "Product Support Engineer",
          bullets: [
            "Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users",
          ],
        },
      ],
      optimizations: [
        {
          experience_title: "Product Support Engineer",
          bullets: [
            {
              action: "replace",
              original:
                "Diagnosed and resolved production issues across APIs and PostgreSQL database queries, improving query performance and ensuring reliable functionality for end users",
              rewritten:
                "Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
            },
          ],
        },
      ],
      tailored_resume_input: {
        experience_rewrites: [
          {
            title: "Product Support Engineer",
            bullets: [
              "Diagnosed and resolved production issues in APIs and PostgreSQL, enhancing query performance and system reliability",
            ],
          },
        ],
        projects_rewrites: [],
      },
    });

    expect(sections).toEqual([
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
        ],
      },
    ]);
  });
});
