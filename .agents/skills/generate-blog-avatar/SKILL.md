---
name: generate-blog-avatar
description: >-
  Use this skill when the user asks to generate an avatar, illustration, or cover image for the blog, or asks to generate their image in Notion style.
---

# Generate Blog Avatar

When generating an avatar or illustration for the blog owner, use the `generate_image` tool with the following base description and constraints:

## Style
- Minimalist black and white line art in the style of Notion app graphics.
- Clean, continuous strokes, no shading, simple vector art style, very minimal.
- Flat white background.

## Character Description
- A young Asian man with a thoughtful facial expression.
- Solid black hair tied back in a man bun (hair is filled with solid black color).
- Wearing black square glasses.
- Wearing a traditional Vietnamese Ao Dai tunic.

## Default Pose and Setting
Unless specified otherwise by the user, use the following default pose and setting:
- Sitting cross-legged on a chair.
- Working on a laptop that is placed on a desk in front of him.
- Background features a cozy interior room setting (e.g., a study room with a window, bookshelves, or indoor plants).

## Aspect Ratio
- Default to `16:9` for cover images.
- Use `1:1` or `3:4` if a profile picture or avatar is requested.
