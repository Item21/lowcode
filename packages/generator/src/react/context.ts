import ts from "typescript"
import { Component } from './component'
import grommetTable from './grommet/table'
//import reactIntlTag from './react-intl/formatted-tag'

export class DefaultImportBuilder {
    imports: ts.ImportDeclaration[] = []
    tableComponents: TableComponents

    constructor() {
        this.tableComponents = grommetTable
        //TODO this.formatComporntns = reactIntlTag
        //import { formattedDate, formattedTime, formattedNumber, formattedDateTimeRange, formattedRelativeTime, formattedPlural, formattedMessage } from './react-intl/formatted-tag'
        //formattedDate.importDeclaration, formattedTime.importDeclaration, formattedNumber.importDeclaration, 
        //formattedDateTimeRange.importDeclaration, formattedRelativeTime.importDeclaration, 
        //formattedPlural.importDeclaration, formattedMessage.importDeclaration
    }

    unique() {
        return this.imports // TODO unique
    }

    importDeclaration(declaration: ts.ImportDeclaration) {
        this.imports = [...this.imports, declaration]
    }

    importTable() {
        const component = this.tableComponents.table
        this.importDeclaration(component.importDeclaration)
        return component
    }
    importRow() {
        const component = this.tableComponents.row
        this.importDeclaration(component.importDeclaration)
        return component
    }
    importCell() {
        const component = this.tableComponents.cell
        this.importDeclaration(component.importDeclaration)
        return component
    }

    // importMessage() {
    //     const component = this.components.message
    //     this.importDeclaration(component.importDeclaration)
    //     return component
    // }
}

export class GenContext {
    imports = new DefaultImportBuilder()
}

export interface GenContextImport {
    importDeclaration(declaration: ts.ImportDeclaration): void
}

export interface TableImports {
    importTable(): Component
    importRow(): Component
    importCell(): Component
}

export interface TableComponents {
    readonly table: Component,
    readonly row: Component,
    readonly cell: Component,
    readonly header: Component,
    readonly body: Component,
    readonly footer: Component
}

export interface FormatComponents {
    readonly message: Component
}

export interface FormatImports {
    importMessage(): Component
    // formattedDate, formattedTime, formattedNumber, formattedDateTimeRange, formattedRelativeTime, formattedPlural, formattedMessage
}
