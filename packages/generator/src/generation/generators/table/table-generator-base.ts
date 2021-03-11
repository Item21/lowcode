import { Property } from '../../entity/index'
import GenerationContext from '../../context'
import ts, { factory } from "typescript"
import { TableComponentDefinitionBase } from '../../../definition/table-definition-core'
import { Component } from '../../react-components/react-component-helper'
import { camalizeString } from '../../../utils/utils'
import TypescriptHelper from "../../code-generation/ts-helper"
import ReactIntlFormatter from  '../../react-components/react-intl/intl-formatter'
import Pluralize from "typescript-pluralize"

export default abstract class TableGeneratorBase{
    protected readonly context:GenerationContext;
    _imports: ts.ImportDeclaration[] = [];
    protected readonly intlFormatter: ReactIntlFormatter;
    
    constructor(generationContext: GenerationContext){
        this.context = generationContext;
        this.intlFormatter = new ReactIntlFormatter(this.context, this._imports);
    }

    protected getProperties(): Property[]{
        return this.context.entity.properties.filter(this.filterProp)
    }

    protected abstract getTableDefinition(): TableComponentDefinitionBase

    protected uniqueImports(){
        return TypescriptHelper.uniqueImports(this._imports);
    }

    private filterProp(prop: Property) {
        const propName = prop.getName().toLowerCase()
        return propName !== '__typename' && propName.indexOf('children') < 0
    }

    protected prepareComponent(component: Component): Component {
        this._imports = [...this._imports, component.importDeclaration]
        return component;
    }

    protected getEntityName(){
        return camalizeString(this.context.entity.getName())
    }

    protected getInputParameterIdentifier() : ts.Identifier {
        return factory.createIdentifier(Pluralize.plural(this.getEntityName()))
    }

    protected localizePropertyNameWithTag(property: Property): ts.JsxSelfClosingElement {
        return this.intlFormatter.localizePropertyNameUsingTag(property, this.context.entity)
    }

    protected getHeaderTitle(property: Property): ts.Expression{
        let localizedName: ts.Expression;
  
        if(this.context.useFormatter){
          localizedName = this.intlFormatter.localizePropertyNameUsingTag(property, this.context.entity);
        }else{
          localizedName = 
            factory.createStringLiteral(property.getName())
        }
  
        return localizedName;
    }

    protected createInputParameter(): ts.ParameterDeclaration {
        return factory.createParameterDeclaration(
          undefined,
          undefined,
          undefined,
          factory.createObjectBindingPattern([factory.createBindingElement(
            undefined,
            undefined,
            this.getInputParameterIdentifier(),
            undefined
          )]),
          undefined,
          undefined,
          undefined
        )
    }
}