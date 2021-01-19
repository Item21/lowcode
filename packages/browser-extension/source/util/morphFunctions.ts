import { Project } from "ts-morph"

export const addRelativeImportWithMorph = (
  project: Project,
  code: string,
  newPageName: string
) => {
  const alteredFile = project.createSourceFile(`App.tsx`, code)
  alteredFile.addImportDeclaration({
    defaultImport: newPageName,
    moduleSpecifier: `./pages/${newPageName}`,
  })
  return alteredFile
}

export const renameFunctionWithMorph = (
  project: Project,
  code: string,
  functionName: string,
  newFunctionName: string
) => {
  const newProject = project.createSourceFile(`${newFunctionName}.tsx`, code)
  const mainFunction = newProject.getFunction(functionName)
  mainFunction?.rename(newFunctionName)
  return newProject
}
