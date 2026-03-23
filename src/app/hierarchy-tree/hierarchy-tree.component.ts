import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { MatTreeModule, MatTree } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IAssemblyHierarchy } from '../final-setup/data.model';

interface TreeNode {
  hierarchyId: string;
  assemblyName: string;
  children: TreeNode[];
}

@Component({
  selector: 'app-hierarchy-tree',
  standalone: true,
  imports: [MatTreeModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './hierarchy-tree.component.html',
  styleUrl: './hierarchy-tree.component.scss',
})
export class HierarchyTreeComponent implements OnChanges {
  @Input() hierarchy!: IAssemblyHierarchy;
  @Input() selectedId: string | null = null;
  @Output() nodeSelected = new EventEmitter<string>();

  @ViewChild(MatTree) private tree!: MatTree<TreeNode>;

  treeData: TreeNode[] = [];
  childrenAccessor = (node: TreeNode) => node.children;
  hasChild = (_: number, node: TreeNode) => node.children.length > 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['hierarchy'] && this.hierarchy) {
      this.treeData = this.buildTree();
      setTimeout(() => this.tree?.expandAll());
    }
  }

  private buildTree(): TreeNode[] {
    const build = (id: string): TreeNode => {
      const node = this.hierarchy.nodes[id];
      return {
        hierarchyId: node.hierarchyId,
        assemblyName: node.assemblyName || node.hierarchyId,
        children: (node.childIds ?? []).map(build).sort((a, b) => a.assemblyName.localeCompare(b.assemblyName)),
      };
    };
    return this.hierarchy.rootIds.map(build).sort((a, b) => a.assemblyName.localeCompare(b.assemblyName));
  }

  onNodeClick(node: TreeNode): void {
    this.nodeSelected.emit(node.hierarchyId);
  }
}
