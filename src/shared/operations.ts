import {z} from 'zod';
import {identifier} from './manifest.ts';
export const toolDefinitions: Array<[string, string, z.ZodRawShape, boolean]> = [
    ['list_presentations', 'List local presentation IDs and source directories.', {}, true],
    ['create_presentation', 'Scaffold a source presentation, optionally from a profile directory. Edit the returned files with normal file tools.', {id: identifier, title: z.string().min(1), theme: z.enum(['editorial','midnight']).optional(), directory: z.string().optional(), profile: z.string().optional().describe('Profile directory: scaffold from its template and link its brand, styles and guidelines. Overrides theme.')}, false],
    ['register_presentation', 'Register an existing Freyja source directory without rewriting it.', {directory: z.string()}, false],
    ['inspect_presentation', 'Read outline, brand, step labels, source graph and SDK location. Content remains in source files.', {id: identifier}, true],
    ['preview_presentation', 'Start or reuse a live local preview and return its URL.', {id: identifier}, false],
    ['open_presentation', 'Navigate connected presentation views to a slide and step; return a deep link if no view is connected.', {id: identifier, slideId: identifier.optional(), step: z.number().int().min(0).optional()}, false],
    ['get_presentation_state', 'Inspect the last reported position and number of connected presentation views.', {id: identifier}, true],
    ['render_slide', 'Capture a slide step in an isolated browser without moving the live presentation. Requires Playwright Chromium.', {id: identifier, slideId: identifier, step: z.number().int().min(0)}, true],
    ['validate_presentation', 'Validate sources and compile the deck; return diagnostics. Screenshots are a separate quality check.', {id: identifier}, true],
    ['export_pdf', 'Export fully rendered slides to PDF without moving the presenter. One final-state page per slide by default; allSteps includes every interaction step. Requires Playwright Chromium.', {id: identifier, allSteps: z.boolean().optional()}, false],
    ['export_pptx', 'Export fully rendered slides to PowerPoint without moving the presenter: each slide is a full-bleed 2x image (not editable shapes), titled in its alt text, with the transitions declared in deck.json. One final-state slide per slide by default; allSteps includes every interaction step. Requires Playwright Chromium.', {id: identifier, allSteps: z.boolean().optional()}, false],
    ['build_presentation', 'Build a standalone static HTML directory and record its revision.', {id: identifier}, false],
  ];
