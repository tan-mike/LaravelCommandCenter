const ArtisanBridge = require('./ArtisanBridge');
const fs = require('fs');
const path = require('path');

class RouteService {
  /**
   * Get enriched routes for a project
   * @param {string} projectPath 
   */
  async getRoutes(projectPath) {
    try {
      const routes = await ArtisanBridge.getRoutes(projectPath);
      
      // Enrich with file paths
      return routes.map(route => {
        const resolution = this.resolveAction(projectPath, route.action);
        return {
          ...route,
          file: resolution.file,
          line: resolution.line
        };
      });
    } catch (error) {
      console.error('RouteService Error:', error);
      throw error;
    }
  }

  /**
   * Resolve file path from route action
   */
  resolveAction(projectPath, action) {
    if (!action || action === 'Closure') {
      return { file: null, line: 0 };
    }

    // Handle "Controller@method"
    const [className, methodName] = action.split('@');
    
    if (!className) return { file: null, line: 0 };

    // Basic PSR-4 mapping assumption: App\ -> app/
    // This could be improved by reading composer.json autoload
    let relativePath = className;
    if (relativePath.startsWith('App\\')) {
      relativePath = relativePath.replace('App\\', 'app\\');
    } else if (relativePath.startsWith('app\\')) {
       // already lower case app ?
    }
    
    // Replace namespaces with path separators
    relativePath = relativePath.replace(/\\/g, '/') + '.php';
    
    const fullPath = path.join(projectPath, relativePath);

    // Verify file exists (optional, could be slow if doing sync checks for many routes)
    // For performance, we might blindly trust the mapping or doing a quick check if needed.
    // Let's assume the mapping is correct to be fast.
    
    return {
      file: fullPath,
      line: 1, // Line number resolution requires reading file, expensive for lists
      method: methodName
    };
  }
}

module.exports = new RouteService();
