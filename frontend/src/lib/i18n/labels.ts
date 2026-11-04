export function localizeDefaultBranchName(name: string, translatedMainBranch: string): string {
  return name.trim().toLowerCase() === 'main branch' ? translatedMainBranch : name;
}
