import { describe, expect, it } from "vitest";

import {
  buildExperienceSection,
  buildLatexDocument,
  buildProjectsSection,
  parseTailoredResumeInput,
  sanitizeNameForFile,
} from "./logic";
import { JAKES_RESUME_TEMPLATE } from "./templates/jakes-resume.template";

describe("generate-tailored-resume logic", () => {
  it("prefers model experience rewrites over optimization-derived rewrites when titles align", () => {
    const input = parseTailoredResumeInput(
      {
        job: {
          company: "Wavform",
          title: "Product Support Engineer",
        },
        match: {
          summary: "Strong fit for the role.",
        },
        skills: ["PostgreSQL", "APIs"],
        optimizations: [
          {
            experience_title: "Product Support Engineer at Wavform",
            role_before: "Product Support Engineer",
            role_after: "Product Support Engineer",
            bullets: [
              {
                rewritten: "Optimization-derived bullet that should not win",
              },
            ],
          },
        ],
        tailored_resume_input: {
          experience_rewrites: [
            {
              company: "Wavform",
              title: "Product Support Engineer",
              bullets: [
                "Model-authored bullet that should win",
              ],
            },
          ],
          projects_rewrites: [
            {
              name: "Support Dashboard",
              bullets: ["Built an internal reporting dashboard"],
            },
          ],
          education: {
            school: "Temple University",
            degree: "B.S. Computer Science",
            grad_date: "May 2024",
          },
        },
      },
      "Jane Doe\nPhiladelphia, PA",
    );

    expect(input).toEqual({
      target_role: "Product Support Engineer",
      target_company: "Wavform",
      summary: "Strong fit for the role.",
      selected_skills: ["PostgreSQL", "APIs"],
      experience_rewrites: [
        {
          company: "Wavform",
          title: "Product Support Engineer",
          bullets: ["Model-authored bullet that should win"],
        },
      ],
      projects_rewrites: [
        {
          name: "Support Dashboard",
          bullets: ["Built an internal reporting dashboard"],
        },
      ],
      education: {
        school: "Temple University",
        degree: "B.S. Computer Science",
        grad_date: "May 2024",
      },
    });
  });

  it("falls back to optimization-derived experience rewrites when tailored_resume_input is missing", () => {
    const input = parseTailoredResumeInput(
      {
        job: {
          company: "Wavform",
          title: "Product Support Engineer",
        },
        optimizations: [
          {
            role_after: "Senior Product Support Engineer",
            bullets: [
              {
                rewritten: "Reduced production issue resolution time by 22% across API and database incidents",
              },
            ],
          },
        ],
      },
      "Jane Doe\nPhiladelphia, PA",
    );

    expect(input.experience_rewrites).toEqual([
      {
        company: "Wavform",
        title: "Senior Product Support Engineer",
        bullets: ["Reduced production issue resolution time by 22% across API and database incidents"],
      },
    ]);
  });

  it("does not duplicate a role when optimization titles include a company suffix", () => {
    const input = parseTailoredResumeInput(
      {
        job: {
          company: "Wavform",
          title: "Product Support Engineer",
        },
        optimizations: [
          {
            experience_title: "Product Support Engineer at Wavform",
            role_before: "Product Support Engineer at Wavform",
            role_after: "Product Support Engineer at Wavform",
            bullets: [
              {
                rewritten: "Optimization-derived bullet that should merge into the existing role",
              },
            ],
          },
        ],
        tailored_resume_input: {
          experience_rewrites: [
            {
              company: "Wavform",
              title: "Product Support Engineer",
              bullets: ["Model bullet for the same role"],
            },
            {
              company: "Temple University",
              title: "Technical Support Specialist",
              bullets: ["Second role should remain in place"],
            },
          ],
          projects_rewrites: [],
          education: {
            school: "Temple University",
            degree: "B.S. Computer Science",
            grad_date: "May 2024",
          },
        },
      },
      "Jane Doe\nPhiladelphia, PA",
    );

    expect(input.experience_rewrites).toEqual([
      {
        company: "Wavform",
        title: "Product Support Engineer",
        bullets: ["Model bullet for the same role"],
      },
      {
        company: "Temple University",
        title: "Technical Support Specialist",
        bullets: ["Second role should remain in place"],
      },
    ]);
  });

  it("ignores optimization role titles that are actually bullet blocks", () => {
    const input = parseTailoredResumeInput(
      {
        job: {
          company: "Wavform",
          title: "Product Support Engineer",
        },
        optimizations: [
          {
            role_before:
              "- Diagnosed and resolved production issues across APIs and PostgreSQL database queries\n- Acted as a primary point of contact for user-reported issues",
            role_after:
              "- Diagnosed and resolved production issues in APIs and PostgreSQL\n- Served as primary liaison for technical issue resolution",
            bullets: [
              {
                rewritten: "Optimization-derived bullet that should not create a fake title",
              },
            ],
          },
        ],
        tailored_resume_input: {
          experience_rewrites: [
            {
              company: "Wavform",
              title: "Product Support Engineer",
              bullets: ["Model bullet for the real role"],
            },
          ],
          projects_rewrites: [],
          education: {
            school: "Temple University",
            degree: "B.S. Computer Science",
            grad_date: "May 2024",
          },
        },
      },
      "Jane Doe\nPhiladelphia, PA",
    );

    expect(input.experience_rewrites).toEqual([
      {
        company: "Wavform",
        title: "Product Support Engineer",
        bullets: ["Model bullet for the real role"],
      },
    ]);
  });

  it("builds LaTeX experience and project sections without dropping entries", () => {
    const experienceSection = buildExperienceSection([
      {
        company: "Wavform",
        title: "Product Support Engineer",
        bullets: [
          "Resolved production issues in APIs and PostgreSQL",
          "Communicated technical findings to cross-functional teams",
        ],
      },
      {
        company: "Temple University",
        title: "Technical Support Specialist",
        bullets: [
          "Responded to on-call incidents and restored user access",
        ],
      },
    ]);
    const projectsSection = buildProjectsSection([
      {
        name: "Support Dashboard",
        bullets: ["Built an internal reporting dashboard"],
      },
      {
        name: "Incident Automation",
        bullets: ["Automated escalation workflows for support incidents"],
      },
    ]);

    expect(experienceSection).toContain("\\section{Experience}");
    expect(experienceSection).toContain("\\resumeSubheading{Wavform}{}{Product Support Engineer}{}");
    expect(experienceSection).toContain("\\resumeSubheading{Temple University}{}{Technical Support Specialist}{}");
    expect(experienceSection).toContain("\\resumeItem{Resolved production issues in APIs and PostgreSQL}");
    expect(projectsSection).toContain("\\section{Projects}");
    expect(projectsSection).toContain("{\\textbf{Support Dashboard}}{}");
    expect(projectsSection).toContain("{\\textbf{Incident Automation}}{}");
  });

  it("builds a full latex document with escaped content and expected sections", () => {
    const latex = buildLatexDocument(
      {
        target_role: "Product Support Engineer",
        target_company: "Wavform",
        summary: "Improved support KPIs by 20% & reduced escalations.",
        selected_skills: ["PostgreSQL", "REST APIs", "ServiceNow"],
        experience_rewrites: [
          {
            company: "Wavform",
            title: "Product Support Engineer",
            bullets: ["Resolved API issues & improved uptime"],
          },
        ],
        projects_rewrites: [
          {
            name: "Support Dashboard",
            bullets: ["Built dashboard for triage metrics"],
          },
        ],
        education: {
          school: "Temple University",
          degree: "B.S. Computer Science",
          grad_date: "May 2024",
        },
      },
      "Jane Doe\njane@example.com | Philadelphia, PA",
      JAKES_RESUME_TEMPLATE,
    );

    expect(latex).toContain("Jane Doe");
    expect(latex).toContain("Product Support Engineer - Wavform");
    expect(latex).toContain("\\section{Summary}");
    expect(latex).toContain("Improved support KPIs by 20\\% \\& reduced escalations.");
    expect(latex).toContain("\\section{Experience}");
    expect(latex).toContain("\\section{Projects}");
    expect(latex).toContain("\\section{Technical Skills}");
    expect(latex).toContain("\\section{Education}");
  });

  it("sanitizes generated filenames deterministically", () => {
    expect(sanitizeNameForFile(" Wavform / Product Support ")).toBe("wavform-product-support");
  });
});
