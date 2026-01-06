
import Dexie, { Table } from 'dexie';
import { DesignDNA } from '../types';

class DesignAppDB extends Dexie {
  // Declare implicit table properties.
  // (just to inform Typescript. Instantiated by Dexie in stores() method)
  designs!: Table<DesignDNA, number>; 

  constructor() {
    super('DesignAppDB');
    
    // Define schema
    // V1: '++id, createdAt, seed'
    // V2: Added 'author'
    (this as any).version(1).stores({
      designs: '++id, createdAt, seed'
    });
    
    (this as any).version(2).stores({
      designs: '++id, createdAt, seed, author'
    });
  }
}

export const db = new DesignAppDB();

/**
 * Saves a completed design to history.
 * @param data Partial DesignDNA data (excluding id and createdAt which are handled automatically)
 * @returns The ID of the inserted record
 */
export const saveDesignToHistory = async (data: Omit<DesignDNA, 'id' | 'createdAt'>): Promise<number> => {
  try {
    const timestamp = Date.now();
    const id = await db.designs.add({
      ...data,
      createdAt: timestamp
    });
    console.log(`[HistoryDB] Saved design #${id}`);
    return id as number;
  } catch (error) {
    console.error(`[HistoryDB] Failed to save design:`, error);
    throw error;
  }
};

/**
 * Retrieves all designs, sorted by newest first.
 * Ideally used for the Gallery View.
 */
export const getAllDesigns = async (): Promise<DesignDNA[]> => {
  try {
    // toCollection().reverse().sortBy('createdAt') is efficient in Dexie
    const designs = await db.designs.orderBy('createdAt').reverse().toArray();
    return designs;
  } catch (error) {
    console.error(`[HistoryDB] Failed to fetch designs:`, error);
    return [];
  }
};

/**
 * Retrieves a single design by ID.
 * Used for reloading a past workspace.
 */
export const getDesignDetail = async (id: number): Promise<DesignDNA | undefined> => {
  try {
    const design = await db.designs.get(id);
    return design;
  } catch (error) {
    console.error(`[HistoryDB] Failed to get design details for #${id}:`, error);
    return undefined;
  }
};

/**
 * Deletes a design from history.
 */
export const deleteDesign = async (id: number): Promise<void> => {
    try {
        await db.designs.delete(id);
    } catch (error) {
        console.error(`[HistoryDB] Failed to delete design #${id}:`, error);
        throw error;
    }
};

/**
 * Deletes all designs from history.
 */
export const clearAllDesigns = async (): Promise<void> => {
    try {
        await db.designs.clear();
    } catch (error) {
        console.error(`[HistoryDB] Failed to clear designs:`, error);
        throw error;
    }
};
