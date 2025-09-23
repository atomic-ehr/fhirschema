import { getCommonPath } from './path-parser.js';
import type { Action, PathComponent } from './types.js';

function sliceChanged(prevItem: PathComponent, newItem: PathComponent): boolean {
    return !!(prevItem.sliceName && newItem.sliceName && prevItem.sliceName !== newItem.sliceName);
}

function exitSliceAction(item: PathComponent): Action {
    if (!item.sliceName) {
        throw new Error('Cannot create exit-slice action for item without sliceName');
    }
    return {
        type: 'exit-slice',
        sliceName: item.sliceName,
        ...(item.slicing && { slicing: item.slicing }),
        ...(item.slice && { slice: item.slice }),
    };
}

function calculateExits(
    prevLength: number,
    commonLength: number,
    prevPath: PathComponent[],
    newPath: PathComponent[],
): Action[] {
    const exits: Action[] = [];

    for (let i = prevLength - 1; i >= commonLength; i--) {
        const prevItem = prevPath[i];

        // Add exit-slice if needed
        if (prevItem.sliceName) {
            exits.push(exitSliceAction(prevItem));
        }

        // Add exit
        exits.push({ type: 'exit', el: prevItem.el });
    }

    // Check for slice change at common boundary
    if (commonLength > 0) {
        const prevItem = prevPath[commonLength - 1];
        const newItem = newPath[commonLength - 1];

        if (sliceChanged(prevItem, newItem)) {
            exits.push(exitSliceAction(prevItem));
        }
    }

    return exits;
}

function calculateEnters(
    commonLength: number,
    newLength: number,
    prevPath: PathComponent[],
    newPath: PathComponent[],
): Action[] {
    const enters: Action[] = [];

    // Check for slice change at common boundary
    if (commonLength > 0 && commonLength <= newLength) {
        const prevItem = prevPath[commonLength - 1] || {};
        const newItem = newPath[commonLength - 1];

        if (
            newItem.sliceName &&
            (!prevItem.sliceName || prevItem.sliceName !== newItem.sliceName)
        ) {
            enters.push({ type: 'enter-slice', sliceName: newItem.sliceName });
        }

        // If we're at the same level, return early
        if (commonLength === newLength) {
            return enters;
        }
    }

    // Add enters for new path components
    for (let i = commonLength; i < newLength; i++) {
        const newItem = newPath[i];

        enters.push({ type: 'enter', el: newItem.el });

        if (newItem.sliceName) {
            enters.push({ type: 'enter-slice', sliceName: newItem.sliceName });
        }
    }

    return enters;
}

export function calculateActions(prevPath: PathComponent[], newPath: PathComponent[]): Action[] {
    const prevLength = prevPath.length;
    const newLength = newPath.length;
    const commonPath = getCommonPath(prevPath, newPath);
    const commonLength = commonPath.length;

    const exits = calculateExits(prevLength, commonLength, prevPath, newPath);
    const enters = calculateEnters(commonLength, newLength, prevPath, newPath);

    return [...exits, ...enters];
}
