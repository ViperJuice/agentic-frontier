// Add this debug logging to ensureProject function (around line 200-210)
// Right after: const projectPath = event.cwd || event.project_dir;
console.log("DEBUG: projectPath resolved to:", projectPath);

// Right before the try block:
console.log("DEBUG: Attempting to find/create project:", projectPath);

// Inside the catch block (around line 235):
console.error('DEBUG: Project creation failed with error:', error.message, error.code);
