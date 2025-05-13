import { defineCollection, z } from 'astro:content';

const layouts = defineCollection({
  type: 'data',
  schema: z.object({
    header: z.any().optional(),
    main: z.any().optional(),
    footer: z.any().nullable().optional(),
  })
});

const dashboard = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    main: z.record(z.any()).nullable().optional() // Permite cualquier estructura en main
  })
});

export const collections = {
  layouts,
  dashboard
};