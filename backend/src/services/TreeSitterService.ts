import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import Go from 'tree-sitter-go';
import { readFile } from 'fs/promises';
import { logWithTimestamp } from '../utils';
import type { File } from '../types';

interface ParsedStructure {
  id: string;
  name: string;
  type: 'class' | 'function' | 'method' | 'constructor' | 'property' | 'interface' | 'enum' | 'type';
  visibility?: 'public' | 'private' | 'protected' | 'static';
  is_async: boolean;
  is_static: boolean;
  is_abstract: boolean;
  start_line: number;
  end_line: number;
  start_column: number;
  end_column: number;
  parameters?: Array<{ name: string; type?: string; default_value?: string }>;
  return_type?: string;
  decorators?: string[];
  docstring?: string;
  complexity_score: number;
  parent_id?: string;
  depth: number;

  // Visualization metadata
  district_x: number;
  district_y: number;
  building_type: string;
  building_color: string;
  building_size: number;
}

export class TreeSitterService {
  private parsers: Map<string, Parser> = new Map();

  constructor() {
    this.initializeParsers();
  }

  private initializeParsers() {
    try {
      // TypeScript parser
      const tsParser = new Parser();
      tsParser.setLanguage(TypeScript.typescript as any);
      this.parsers.set('ts', tsParser);
      this.parsers.set('tsx', tsParser);

      // JavaScript parser
      const jsParser = new Parser();
      jsParser.setLanguage(JavaScript as any);
      this.parsers.set('js', jsParser);
      this.parsers.set('jsx', jsParser);

      // Python parser
      const pyParser = new Parser();
      pyParser.setLanguage(Python as any);
      this.parsers.set('py', pyParser);

      // Rust parser
      const rsParser = new Parser();
      rsParser.setLanguage(Rust as any);
      this.parsers.set('rs', rsParser);

      // Go parser
      const goParser = new Parser();
      goParser.setLanguage(Go as any);
      this.parsers.set('go', goParser);

      logWithTimestamp('[TreeSitter] Parsers initialized for: ts, tsx, js, jsx, py, rs, go');
    } catch (error) {
      console.error('[TreeSitter] Failed to initialize parsers:', error);
    }
  }

  /**
   * Parse a file and extract code structures
   */
  async parseFile(file: File): Promise<ParsedStructure[]> {
    const extension = file.extension || file.path.split('.').pop() || '';
    const parser = this.parsers.get(extension);

    if (!parser) {
      logWithTimestamp(`[TreeSitter] No parser for extension: ${extension}`);
      return [];
    }

    try {
      // Read file content
      const fileContent = await readFile(file.path, 'utf-8');

      // Parse AST
      const tree = parser.parse(fileContent);

      // Extract structures
      const structures = this.extractStructures(tree.rootNode, fileContent, extension);

      // Enrich with visualization data
      const enrichedStructures = this.enrichWithVisualizationData(structures);

      logWithTimestamp(`[TreeSitter] Parsed ${file.path}: found ${enrichedStructures.length} structures`);
      return enrichedStructures;

    } catch (error) {
      console.error(`[TreeSitter] Error parsing ${file.path}:`, error);
      return [];
    }
  }

  private extractStructures(
    node: Parser.SyntaxNode,
    sourceCode: string,
    language: string
  ): ParsedStructure[] {
    if (language === 'ts' || language === 'tsx' || language === 'js' || language === 'jsx') {
      return this.extractTypeScriptStructures(node, sourceCode);
    } else if (language === 'py') {
      return this.extractPythonStructures(node, sourceCode);
    } else if (language === 'rs') {
      return this.extractRustStructures(node, sourceCode);
    } else if (language === 'go') {
      return this.extractGoStructures(node, sourceCode);
    }
    return [];
  }

  private extractTypeScriptStructures(
    node: Parser.SyntaxNode,
    sourceCode: string
  ): ParsedStructure[] {
    const structures: ParsedStructure[] = [];
    const idCounter = { value: 0 };

    const traverse = (n: Parser.SyntaxNode, parentId?: string, depth: number = 0) => {
      // Class declarations
      if (n.type === 'class_declaration') {
        const structure = this.extractClass(n, sourceCode, parentId, depth, idCounter);
        structures.push(structure);

        // Recursively extract class members
        const classBody = n.childForFieldName('body');
        if (classBody) {
          classBody.children.forEach(child => {
            traverse(child, structure.id, depth + 1);
          });
        }
      }

      // Method definitions (inside classes)
      else if (n.type === 'method_definition') {
        const structure = this.extractMethod(n, sourceCode, parentId, depth, idCounter);
        if (structure) structures.push(structure);
      }

      // Function declarations (top-level)
      else if (n.type === 'function_declaration') {
        const structure = this.extractFunction(n, sourceCode, parentId, depth, idCounter);
        if (structure) structures.push(structure);
      }

      // Arrow functions (assigned to variables)
      else if (n.type === 'lexical_declaration' || n.type === 'variable_declaration') {
        const arrowFunc = this.findArrowFunction(n, sourceCode, parentId, depth, idCounter);
        if (arrowFunc) structures.push(arrowFunc);
      }

      // Interface declarations
      else if (n.type === 'interface_declaration') {
        const structure = this.extractInterface(n, sourceCode, parentId, depth, idCounter);
        if (structure) structures.push(structure);
      }

      // Enum declarations
      else if (n.type === 'enum_declaration') {
        const structure = this.extractEnum(n, sourceCode, parentId, depth, idCounter);
        if (structure) structures.push(structure);
      }

      // Type aliases
      else if (n.type === 'type_alias_declaration') {
        const structure = this.extractTypeAlias(n, sourceCode, parentId, depth, idCounter);
        if (structure) structures.push(structure);
      }

      // Recurse for other nodes
      else if (!['method_definition', 'class_declaration'].includes(n.type)) {
        n.children.forEach(child => traverse(child, parentId, depth));
      }
    };

    traverse(node);
    return structures;
  }

  private extractClass(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? sourceCode.substring(nameNode.startIndex, nameNode.endIndex) : 'AnonymousClass';

    const id = this.generateId(idCounter);

    // Extract decorators
    const decorators: string[] = [];
    const previousSibling = node.previousSibling;
    if (previousSibling && previousSibling.type === 'decorator') {
      decorators.push(sourceCode.substring(previousSibling.startIndex, previousSibling.endIndex));
    }

    // Extract JSDoc
    const docstring = this.extractJSDoc(node, sourceCode);

    // Check if abstract
    const isAbstract = this.hasModifier(node, sourceCode, 'abstract');

    return {
      id,
      name,
      type: 'class',
      visibility: 'public',
      is_async: false,
      is_static: false,
      is_abstract: isAbstract,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      decorators,
      docstring,
      complexity_score: this.calculateComplexity(node),
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#3498db',
      building_type: 'commercial_modern'
    };
  }

  private extractMethod(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    // Extract parameters
    const parameters = this.extractParameters(node, sourceCode);

    // Extract return type
    const returnType = this.extractReturnType(node, sourceCode);

    // Check modifiers
    const isStatic = this.hasModifier(node, sourceCode, 'static');
    const isAsync = this.hasModifier(node, sourceCode, 'async');
    const visibility = this.extractVisibility(node, sourceCode);

    // Check if constructor
    const isConstructor = name === 'constructor';

    return {
      id,
      name,
      type: isConstructor ? 'constructor' : 'method',
      visibility,
      is_async: isAsync,
      is_static: isStatic,
      is_abstract: false,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      parameters,
      return_type: returnType,
      docstring: this.extractJSDoc(node, sourceCode),
      complexity_score: this.calculateComplexity(node),
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#e74c3c',
      building_type: 'residential'
    };
  }

  private extractFunction(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    const parameters = this.extractParameters(node, sourceCode);
    const returnType = this.extractReturnType(node, sourceCode);
    const isAsync = this.hasModifier(node, sourceCode, 'async');

    return {
      id,
      name,
      type: 'function',
      visibility: 'public',
      is_async: isAsync,
      is_static: false,
      is_abstract: false,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      parameters,
      return_type: returnType,
      docstring: this.extractJSDoc(node, sourceCode),
      complexity_score: this.calculateComplexity(node),
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#2ecc71',
      building_type: 'industrial'
    };
  }

  private findArrowFunction(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    // Look for pattern: const name = () => {}
    const declarator = node.descendantsOfType('variable_declarator')[0];
    if (!declarator) return null;

    const nameNode = declarator.childForFieldName('name');
    const valueNode = declarator.childForFieldName('value');

    if (!nameNode || !valueNode || valueNode.type !== 'arrow_function') return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    const parameters = this.extractParameters(valueNode, sourceCode);
    const returnType = this.extractReturnType(valueNode, sourceCode);
    const isAsync = valueNode.text.trim().startsWith('async');

    return {
      id,
      name,
      type: 'function',
      visibility: 'public',
      is_async: isAsync,
      is_static: false,
      is_abstract: false,
      start_line: valueNode.startPosition.row + 1,
      end_line: valueNode.endPosition.row + 1,
      start_column: valueNode.startPosition.column,
      end_column: valueNode.endPosition.column,
      parameters,
      return_type: returnType,
      complexity_score: this.calculateComplexity(valueNode),
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#2ecc71',
      building_type: 'industrial'
    };
  }

  private extractInterface(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    return {
      id,
      name,
      type: 'interface',
      visibility: 'public',
      is_async: false,
      is_static: false,
      is_abstract: false,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      docstring: this.extractJSDoc(node, sourceCode),
      complexity_score: 1,
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#3498db',
      building_type: 'commercial_modern'
    };
  }

  private extractEnum(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    return {
      id,
      name,
      type: 'enum',
      visibility: 'public',
      is_async: false,
      is_static: false,
      is_abstract: false,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      complexity_score: 1,
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#9b59b6',
      building_type: 'commercial'
    };
  }

  private extractTypeAlias(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    return {
      id,
      name,
      type: 'type',
      visibility: 'public',
      is_async: false,
      is_static: false,
      is_abstract: false,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      complexity_score: 1,
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#1abc9c',
      building_type: 'commercial'
    };
  }

  // ==================== PYTHON EXTRACTION ====================

  private extractPythonStructures(
    node: Parser.SyntaxNode,
    sourceCode: string
  ): ParsedStructure[] {
    const structures: ParsedStructure[] = [];
    const idCounter = { value: 0 };

    const traverse = (n: Parser.SyntaxNode, parentId?: string, depth: number = 0) => {
      // Class definitions
      if (n.type === 'class_definition') {
        const structure = this.extractPythonClass(n, sourceCode, parentId, depth, idCounter);
        if (structure) {
          structures.push(structure);

          // Extract methods from class body
          const bodyNode = n.childForFieldName('body');
          if (bodyNode) {
            bodyNode.children.forEach(child => {
              traverse(child, structure.id, depth + 1);
            });
          }
        }
      }

      // Function definitions
      else if (n.type === 'function_definition') {
        const structure = this.extractPythonFunction(n, sourceCode, parentId, depth, idCounter);
        if (structure) structures.push(structure);
      }

      // Decorated definitions
      else if (n.type === 'decorated_definition') {
        const definition = n.childForFieldName('definition');
        if (definition) {
          traverse(definition, parentId, depth);
        }
      }

      // Recurse for other nodes
      else if (!['class_definition', 'function_definition'].includes(n.type)) {
        n.children.forEach(child => traverse(child, parentId, depth));
      }
    };

    traverse(node);
    return structures;
  }

  private extractPythonClass(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    // Extract decorators
    let decorators: string[] = [];
    if (node.parent && node.parent.type === 'decorated_definition') {
      const decoratorNodes = node.parent.children.filter(c => c.type === 'decorator');
      decorators = decoratorNodes.map(d => sourceCode.substring(d.startIndex, d.endIndex));
    }

    // Extract docstring
    const docstring = this.extractPythonDocstring(node, sourceCode);

    return {
      id,
      name,
      type: 'class',
      visibility: 'public',
      is_async: false,
      is_static: false,
      is_abstract: false,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      decorators,
      docstring,
      complexity_score: this.calculateComplexity(node),
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#3498db',
      building_type: 'commercial_modern'
    };
  }

  private extractPythonFunction(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    // Extract parameters
    const parameters = this.extractPythonParameters(node, sourceCode);

    // Check if async
    const isAsync = node.children.some(child => child.type === 'async');

    // Extract decorators
    let decorators: string[] = [];
    if (node.parent && node.parent.type === 'decorated_definition') {
      const decoratorNodes = node.parent.children.filter(c => c.type === 'decorator');
      decorators = decoratorNodes.map(d => sourceCode.substring(d.startIndex, d.endIndex));
    }

    // Extract docstring
    const docstring = this.extractPythonDocstring(node, sourceCode);

    // Determine if it's a method or function
    const isMethod = parentId !== undefined;

    return {
      id,
      name,
      type: isMethod ? 'method' : 'function',
      visibility: name.startsWith('_') ? 'private' : 'public',
      is_async: isAsync,
      is_static: decorators.some(d => d.includes('@staticmethod')),
      is_abstract: decorators.some(d => d.includes('@abstractmethod')),
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      parameters,
      decorators,
      docstring,
      complexity_score: this.calculateComplexity(node),
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: isMethod ? '#e74c3c' : '#2ecc71',
      building_type: isMethod ? 'residential' : 'industrial'
    };
  }

  private extractPythonParameters(node: Parser.SyntaxNode, sourceCode: string): Array<{ name: string; type?: string }> {
    const params: Array<{ name: string; type?: string }> = [];
    const paramsNode = node.childForFieldName('parameters');

    if (!paramsNode) return params;

    paramsNode.children.forEach(child => {
      if (child.type === 'identifier') {
        params.push({ name: sourceCode.substring(child.startIndex, child.endIndex) });
      } else if (child.type === 'typed_parameter') {
        const nameNode = child.childForFieldName('name');
        const typeNode = child.childForFieldName('type');
        if (nameNode) {
          params.push({
            name: sourceCode.substring(nameNode.startIndex, nameNode.endIndex),
            type: typeNode ? sourceCode.substring(typeNode.startIndex, typeNode.endIndex) : undefined
          });
        }
      }
    });

    return params;
  }

  private extractPythonDocstring(node: Parser.SyntaxNode, sourceCode: string): string | undefined {
    const bodyNode = node.childForFieldName('body');
    if (!bodyNode) return undefined;

    // Look for first string in body
    const firstChild = bodyNode.children.find(c => c.type === 'expression_statement');
    if (firstChild) {
      const stringNode = firstChild.children.find(c => c.type === 'string');
      if (stringNode) {
        return sourceCode.substring(stringNode.startIndex, stringNode.endIndex);
      }
    }

    return undefined;
  }

  // ==================== RUST EXTRACTION ====================

  private extractRustStructures(
    node: Parser.SyntaxNode,
    sourceCode: string
  ): ParsedStructure[] {
    const structures: ParsedStructure[] = [];
    const idCounter = { value: 0 };

    const traverse = (n: Parser.SyntaxNode, parentId?: string, depth: number = 0) => {
      // Struct definitions
      if (n.type === 'struct_item') {
        const structure = this.extractRustStruct(n, sourceCode, parentId, depth, idCounter);
        if (structure) structures.push(structure);
      }

      // Enum definitions
      else if (n.type === 'enum_item') {
        const structure = this.extractRustEnum(n, sourceCode, parentId, depth, idCounter);
        if (structure) structures.push(structure);
      }

      // Trait definitions
      else if (n.type === 'trait_item') {
        const structure = this.extractRustTrait(n, sourceCode, parentId, depth, idCounter);
        if (structure) structures.push(structure);
      }

      // Implementation blocks
      else if (n.type === 'impl_item') {
        const structure = this.extractRustImpl(n, sourceCode, parentId, depth, idCounter);
        if (structure) {
          structures.push(structure);

          // Extract methods from impl block
          const bodyNode = n.childForFieldName('body');
          if (bodyNode) {
            bodyNode.children.forEach(child => {
              if (child.type === 'function_item') {
                const method = this.extractRustFunction(child, sourceCode, structure.id, depth + 1, idCounter);
                if (method) structures.push(method);
              }
            });
          }
        }
      }

      // Function definitions
      else if (n.type === 'function_item') {
        const structure = this.extractRustFunction(n, sourceCode, parentId, depth, idCounter);
        if (structure) structures.push(structure);
      }

      // Recurse for other nodes
      else if (!['struct_item', 'enum_item', 'trait_item', 'impl_item', 'function_item'].includes(n.type)) {
        n.children.forEach(child => traverse(child, parentId, depth));
      }
    };

    traverse(node);
    return structures;
  }

  private extractRustStruct(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    const visibility = this.extractRustVisibility(node, sourceCode);

    return {
      id,
      name,
      type: 'class', // Rust structs map to classes
      visibility,
      is_async: false,
      is_static: false,
      is_abstract: false,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      complexity_score: 1,
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#3498db',
      building_type: 'commercial_modern'
    };
  }

  private extractRustEnum(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    return {
      id,
      name,
      type: 'enum',
      visibility: this.extractRustVisibility(node, sourceCode),
      is_async: false,
      is_static: false,
      is_abstract: false,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      complexity_score: 1,
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#9b59b6',
      building_type: 'commercial'
    };
  }

  private extractRustTrait(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    return {
      id,
      name,
      type: 'interface', // Rust traits map to interfaces
      visibility: this.extractRustVisibility(node, sourceCode),
      is_async: false,
      is_static: false,
      is_abstract: false,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      complexity_score: 1,
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#3498db',
      building_type: 'laboratory'
    };
  }

  private extractRustImpl(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const typeNode = node.childForFieldName('type');
    if (!typeNode) return null;

    const name = `impl ${sourceCode.substring(typeNode.startIndex, typeNode.endIndex)}`;
    const id = this.generateId(idCounter);

    return {
      id,
      name,
      type: 'class',
      visibility: 'public',
      is_async: false,
      is_static: false,
      is_abstract: false,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      complexity_score: 1,
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#e67e22',
      building_type: 'industrial_modern'
    };
  }

  private extractRustFunction(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    // Check if async
    const isAsync = node.children.some(child => child.type === 'async');

    // Determine if method or function
    const isMethod = parentId !== undefined;

    return {
      id,
      name,
      type: isMethod ? 'method' : 'function',
      visibility: this.extractRustVisibility(node, sourceCode),
      is_async: isAsync,
      is_static: false,
      is_abstract: false,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      complexity_score: this.calculateComplexity(node),
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: isMethod ? '#e74c3c' : '#2ecc71',
      building_type: isMethod ? 'residential' : 'industrial'
    };
  }

  private extractRustVisibility(node: Parser.SyntaxNode, sourceCode: string): 'public' | 'private' | 'protected' | 'static' {
    const visNode = node.children.find(c => c.type === 'visibility_modifier');
    if (visNode) {
      const vis = sourceCode.substring(visNode.startIndex, visNode.endIndex);
      if (vis === 'pub') return 'public';
    }
    return 'private';
  }

  // ==================== GO EXTRACTION ====================

  private extractGoStructures(
    node: Parser.SyntaxNode,
    sourceCode: string
  ): ParsedStructure[] {
    const structures: ParsedStructure[] = [];
    const idCounter = { value: 0 };

    const traverse = (n: Parser.SyntaxNode, parentId?: string, depth: number = 0) => {
      // Type declarations (structs, interfaces)
      if (n.type === 'type_declaration') {
        const typeSpecs = n.descendantsOfType('type_spec');
        typeSpecs.forEach(spec => {
          const typeNode = spec.childForFieldName('type');
          if (typeNode) {
            if (typeNode.type === 'struct_type') {
              const structure = this.extractGoStruct(spec, sourceCode, parentId, depth, idCounter);
              if (structure) structures.push(structure);
            } else if (typeNode.type === 'interface_type') {
              const structure = this.extractGoInterface(spec, sourceCode, parentId, depth, idCounter);
              if (structure) structures.push(structure);
            }
          }
        });
      }

      // Function declarations
      else if (n.type === 'function_declaration') {
        const structure = this.extractGoFunction(n, sourceCode, parentId, depth, idCounter);
        if (structure) structures.push(structure);
      }

      // Method declarations
      else if (n.type === 'method_declaration') {
        const structure = this.extractGoMethod(n, sourceCode, parentId, depth, idCounter);
        if (structure) structures.push(structure);
      }

      // Recurse for other nodes
      else if (!['type_declaration', 'function_declaration', 'method_declaration'].includes(n.type)) {
        n.children.forEach(child => traverse(child, parentId, depth));
      }
    };

    traverse(node);
    return structures;
  }

  private extractGoStruct(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    // Go uses capitalization for visibility
    const visibility = name[0] === name[0].toUpperCase() ? 'public' : 'private';

    return {
      id,
      name,
      type: 'class',
      visibility,
      is_async: false,
      is_static: false,
      is_abstract: false,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      complexity_score: 1,
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#3498db',
      building_type: 'commercial_modern'
    };
  }

  private extractGoInterface(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    const visibility = name[0] === name[0].toUpperCase() ? 'public' : 'private';

    return {
      id,
      name,
      type: 'interface',
      visibility,
      is_async: false,
      is_static: false,
      is_abstract: false,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      complexity_score: 1,
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#3498db',
      building_type: 'laboratory'
    };
  }

  private extractGoFunction(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    const visibility = name[0] === name[0].toUpperCase() ? 'public' : 'private';

    return {
      id,
      name,
      type: 'function',
      visibility,
      is_async: false,
      is_static: false,
      is_abstract: false,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      complexity_score: this.calculateComplexity(node),
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#2ecc71',
      building_type: 'industrial'
    };
  }

  private extractGoMethod(
    node: Parser.SyntaxNode,
    sourceCode: string,
    parentId: string | undefined,
    depth: number,
    idCounter: { value: number }
  ): ParsedStructure | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
    const id = this.generateId(idCounter);

    // Get receiver type for context
    const receiverNode = node.childForFieldName('receiver');
    let receiverType = '';
    if (receiverNode) {
      receiverType = sourceCode.substring(receiverNode.startIndex, receiverNode.endIndex);
    }

    const visibility = name[0] === name[0].toUpperCase() ? 'public' : 'private';

    return {
      id,
      name,
      type: 'method',
      visibility,
      is_async: false,
      is_static: false,
      is_abstract: false,
      start_line: node.startPosition.row + 1,
      end_line: node.endPosition.row + 1,
      start_column: node.startPosition.column,
      end_column: node.endPosition.column,
      docstring: receiverType ? `Receiver: ${receiverType}` : undefined,
      complexity_score: this.calculateComplexity(node),
      parent_id: parentId,
      depth,
      district_x: 0,
      district_y: 0,
      building_size: 1,
      building_color: '#e74c3c',
      building_type: 'residential'
    };
  }

  // Helper methods

  private extractParameters(node: Parser.SyntaxNode, sourceCode: string): Array<{ name: string; type?: string }> {
    const params: Array<{ name: string; type?: string }> = [];
    const paramsNode = node.childForFieldName('parameters');

    if (!paramsNode) return params;

    paramsNode.children.forEach(child => {
      if (child.type === 'required_parameter' || child.type === 'optional_parameter') {
        const nameNode = child.childForFieldName('pattern');
        const typeNode = child.childForFieldName('type');

        if (nameNode) {
          params.push({
            name: sourceCode.substring(nameNode.startIndex, nameNode.endIndex),
            type: typeNode ? sourceCode.substring(typeNode.startIndex, typeNode.endIndex) : undefined
          });
        }
      }
    });

    return params;
  }

  private extractReturnType(node: Parser.SyntaxNode, sourceCode: string): string | undefined {
    const returnTypeNode = node.childForFieldName('return_type');
    if (!returnTypeNode) return undefined;
    return sourceCode.substring(returnTypeNode.startIndex, returnTypeNode.endIndex).replace(/^:\s*/, '');
  }

  private extractVisibility(node: Parser.SyntaxNode, sourceCode: string): 'public' | 'private' | 'protected' | 'static' {
    // Check for visibility modifiers in children
    for (const child of node.children) {
      if (child.type === 'accessibility_modifier') {
        const modifier = sourceCode.substring(child.startIndex, child.endIndex);
        if (modifier === 'private') return 'private';
        if (modifier === 'protected') return 'protected';
        if (modifier === 'public') return 'public';
      }
    }
    return 'public'; // Default
  }

  private hasModifier(node: Parser.SyntaxNode, sourceCode: string, modifier: string): boolean {
    for (const child of node.children) {
      const text = sourceCode.substring(child.startIndex, child.endIndex);
      if (text === modifier) return true;
    }
    return false;
  }

  private extractJSDoc(node: Parser.SyntaxNode, sourceCode: string): string | undefined {
    // Look for comment before node
    let current: Parser.SyntaxNode | null = node.previousSibling;
    while (current && current.type === 'comment') {
      const commentText = sourceCode.substring(current.startIndex, current.endIndex);
      if (commentText.trim().startsWith('/**')) {
        return commentText;
      }
      current = current.previousSibling;
    }
    return undefined;
  }

  private calculateComplexity(node: Parser.SyntaxNode): number {
    // Cyclomatic complexity: count decision points
    let complexity = 1; // Base complexity

    const traverse = (n: Parser.SyntaxNode) => {
      if (['if_statement', 'while_statement', 'for_statement', 'for_in_statement',
           'do_statement', 'switch_statement', 'catch_clause',
           'ternary_expression', 'binary_expression'].includes(n.type)) {

        // For binary expressions, only count logical operators
        if (n.type === 'binary_expression') {
          const operator = n.childForFieldName('operator');
          if (operator && ['&&', '||'].includes(operator.text)) {
            complexity++;
          }
        } else {
          complexity++;
        }
      }
      n.children.forEach(traverse);
    };

    traverse(node);
    return complexity;
  }

  private enrichWithVisualizationData(structures: ParsedStructure[]): ParsedStructure[] {
    // Group structures by parent (to layout children properly)
    const topLevel = structures.filter(s => !s.parent_id);
    const children = new Map<string, ParsedStructure[]>();

    structures.forEach(s => {
      if (s.parent_id) {
        if (!children.has(s.parent_id)) {
          children.set(s.parent_id, []);
        }
        children.get(s.parent_id)!.push(s);
      }
    });

    // Layout top-level structures in a grid
    const gridSize = Math.ceil(Math.sqrt(topLevel.length));
    topLevel.forEach((structure, index) => {
      structure.district_x = index % gridSize;
      structure.district_y = Math.floor(index / gridSize);

      // Calculate building size based on lines of code
      const linesOfCode = structure.end_line - structure.start_line + 1;
      structure.building_size = Math.min(Math.max(1, Math.ceil(linesOfCode / 20)), 10);

      // Layout children of this structure
      const structureChildren = children.get(structure.id) || [];
      const childGridSize = Math.ceil(Math.sqrt(structureChildren.length));

      structureChildren.forEach((child, childIndex) => {
        child.district_x = (structure.district_x * 3) + (childIndex % childGridSize);
        child.district_y = (structure.district_y * 3) + Math.floor(childIndex / childGridSize);

        const childLOC = child.end_line - child.start_line + 1;
        child.building_size = Math.min(Math.max(1, Math.ceil(childLOC / 20)), 10);
      });
    });

    return structures;
  }

  private generateId(counter: { value: number }): string {
    return `struct_${Date.now()}_${counter.value++}`;
  }

  /**
   * Get parser statistics
   */
  getStats() {
    return {
      supportedLanguages: Array.from(this.parsers.keys()),
      parsersInitialized: this.parsers.size
    };
  }
}
