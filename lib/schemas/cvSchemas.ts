import { z } from "zod";

export const personalSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  headline: z.string().optional().or(z.literal("")),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  website: z.string().optional().or(z.literal("")),
  linkedin: z.string().optional().or(z.literal("")),
  summary: z.string().optional().or(z.literal("")),
});

export const summarySchema = z.object({
  summary: z.string().min(30, "Aim for 30+ characters").optional().or(z.literal("")),
});

export const experienceSchema = z.object({
  experience: z
    .array(
      z.object({
        id: z.string(),
        company: z.string().min(1, "Company is required"),
        role: z.string().min(1, "Role is required"),
        location: z.string().optional().or(z.literal("")),
        startDate: z.string().min(1, "Start date is required"),
        endDate: z.string().optional().or(z.literal("")),
        isCurrent: z.boolean(),
        bullets: z.array(z.string().min(3, "Bullet is too short")).min(1, "Add at least one bullet"),
      })
    )
    .min(1, "Add at least one role"),
});

export const educationSchema = z.object({
  education: z
    .array(
      z.object({
        id: z.string(),
        school: z.string().min(1, "School is required"),
        degree: z.string().min(1, "Degree is required"),
        field: z.string().optional().or(z.literal("")),
        startDate: z.string().min(1, "Start date is required"),
        endDate: z.string().optional().or(z.literal("")),
        notes: z.string().optional().or(z.literal("")),
      })
    )
    .min(1, "Add at least one entry"),
});

export const skillsSchema = z.object({
  skills: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Skill is required"),
        level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      })
    )
    .min(1, "Add at least one skill"),
});

export const languagesSchema = z.object({
  languages: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, "Language is required"),
      level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    })
  ),
});

export const certificationsSchema = z.object({
  certifications: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, "Certification is required"),
      issuer: z.string().min(1, "Issuer is required"),
      date: z.string().optional().or(z.literal("")),
    })
  ),
});

export const projectsSchema = z.object({
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, "Project name is required"),
      link: z.string().optional().or(z.literal("")),
      bullets: z.array(z.string().min(3, "Bullet is too short")).min(1, "Add at least one bullet"),
    })
  ),
});

export const settingsSchema = z.object({
  templateId: z.string().min(1),
  accentColor: z.string().optional(),
  fontScale: z.number().optional(),
  sectionOrder: z.array(z.string()).optional(),
});

export const cvSchema = z.object({
  personal: personalSchema,
  experience: experienceSchema.shape.experience,
  education: educationSchema.shape.education,
  skills: skillsSchema.shape.skills,
  languages: languagesSchema.shape.languages,
  certifications: certificationsSchema.shape.certifications,
  projects: projectsSchema.shape.projects,
  settings: settingsSchema,
});
