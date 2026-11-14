import { z } from 'zod'

/** `app:get-version` takes no input. */
export const appGetVersionInputSchema = z.undefined()

/** `app:get-version` output: the `package.json` version and whether the app runs under E2E. */
export const appVersionSchema = z.strictObject({
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'Expected a semver version'),
  e2e: z.boolean(),
})

export type AppVersion = z.infer<typeof appVersionSchema>
