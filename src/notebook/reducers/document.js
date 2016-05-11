import * as commutable from 'commutable';
import * as uuid from 'uuid';

import * as constants from '../constants';

import Immutable from 'immutable';
import { mark } from '../performance';

const noop = state => state;

export default {
  [constants.SET_NOTEBOOK]: function setNotebook(state, action) {
    mark('setNotebook');
    const notebook = action.data;
    return {
      ...state,
      notebook,
      focusedCell: notebook.getIn(['cellOrder', 0]),
    };
  },
  [constants.FOCUS_CELL]: function focusCell(state, action) {
    mark('focusCell');
    const { id } = action;
    return {
      ...state,
      focusedCell: id,
    };
  },
  [constants.FOCUS_NEXT_CELL]: function focusNextCell(state, action) {
    mark('focusNextCell');
    const { notebook } = state;
    const cellOrder = notebook.get('cellOrder');
    const curIndex = cellOrder.findIndex(id => id === action.id);

    const nextIndex = curIndex + 1;

    // When at the end, create a new cell
    if (nextIndex >= cellOrder.size) {
      if (!action.createCellIfUndefined) {
        return state;
      }

      const cellID = uuid.v4();
      // TODO: condition on state.defaultCellType (markdown vs. code)
      const cell = commutable.emptyCodeCell;
      return {
        ...state,
        focusedCell: cellID,
        notebook: commutable.insertCellAt(notebook, cell, cellID, nextIndex),
      };
    }

    // When in the middle of the notebook document, move to the next cell
    return {
      ...state,
      focusedCell: cellOrder.get(nextIndex),
    };
  },
  [constants.FOCUS_PREVIOUS_CELL]: function focusPreviousCell(state, action) {
    mark('focusPreviousCell');
    const { notebook } = state;
    const cellOrder = notebook.get('cellOrder');
    const curIndex = cellOrder.findIndex(id => id === action.id);
    const nextIndex = Math.max(0, curIndex - 1);

    // When in the middle of the notebook document, move to the next cell
    return {
      ...state,
      focusedCell: cellOrder.get(nextIndex),
    };
  },
  [constants.UPDATE_CELL_EXECUTION_COUNT]: function updateExecutionCount(state, action) {
    mark('updateExecutionCount');
    const { id, count } = action;
    const { notebook } = state;
    return {
      ...state,
      notebook: commutable.updateExecutionCount(notebook, id, count),
    };
  },
  [constants.MOVE_CELL]: function moveCell(state, action) {
    mark('moveCell');
    const { notebook } = state;
    return {
      ...state,
      notebook: notebook.update('cellOrder', cellOrder => {
        const oldIndex = cellOrder.findIndex(id => id === action.id);
        const newIndex = cellOrder.findIndex(id => id === action.destinationId)
                          + (action.above ? 0 : 1);
        if (oldIndex === newIndex) {
          return cellOrder;
        }
        return cellOrder
          .splice(oldIndex, 1)
          .splice(newIndex - (oldIndex < newIndex ? 1 : 0), 0, action.id);
      }),
    };
  },
  [constants.REMOVE_CELL]: function removeCell(state, action) {
    mark('removeCell');
    const { notebook } = state;
    const { id } = action;
    return {
      ...state,
      notebook: commutable.removeCell(notebook, id),
    };
  },
  [constants.NEW_CELL_AFTER]: function newCellAfter(state, action) {
    mark('newCellAfter');
    // Draft API
    const { cellType, id, source } = action;
    const { notebook } = state;
    const cell = cellType === 'markdown' ? commutable.emptyMarkdownCell :
                                           commutable.emptyCodeCell;
    const index = notebook.get('cellOrder').indexOf(id) + 1;
    const cellID = uuid.v4();
    return {
      ...state,
      notebook: commutable.insertCellAt(notebook, cell.set('source', source), cellID, index),
    };
  },
  [constants.NEW_CELL_BEFORE]: function newCellBefore(state, action) {
    mark('newCellBefore');
    // Draft API
    const { cellType, id } = action;
    const { notebook } = state;
    const cell = cellType === 'markdown' ? commutable.emptyMarkdownCell :
                                           commutable.emptyCodeCell;
    const index = notebook.get('cellOrder').indexOf(id);
    const cellID = uuid.v4();
    return {
      ...state,
      notebook: commutable.insertCellAt(notebook, cell, cellID, index),
    };
  },
  [constants.MERGE_CELL_AFTER]: function mergeCellAfter(state, action) {
    mark('mergeCellAfter');
    const { id } = action;
    const { notebook } = state;
    const cellOrder = notebook.get('cellOrder');
    const cellMap = notebook.get('cellMap');
    const index = cellOrder.indexOf(id);
    // do nothing if this is the last cell
    if (cellOrder.size === index + 1) {
      return state;
    }
    const nextId = cellOrder.get(index + 1);
    const source = cellMap.getIn([id, 'source'])
                          .concat('\n', '\n', cellMap.getIn([nextId, 'source']));

    return {
      ...state,
      notebook:
        commutable.removeCell(
          commutable.updateSource(notebook, id, source),
        nextId
        ),
    };
  },
  [constants.NEW_CELL_APPEND]: function newCellAppend(state, action) {
    mark('newCellAppend');
    // Draft API
    const { cellType } = action;
    const { notebook } = state;
    const cell = cellType === 'markdown' ? commutable.emptyMarkdownCell :
                                           commutable.emptyCodeCell;
    const index = notebook.get('cellOrder').count();
    const cellID = uuid.v4();
    return {
      ...state,
      notebook: commutable.insertCellAt(notebook, cell, cellID, index),
    };
  },
  [constants.UPDATE_CELL_SOURCE]: function updateSource(state, action) {
    mark('updateSource');
    const { id, source } = action;
    const { notebook } = state;
    return {
      ...state,
      notebook: commutable.updateSource(notebook, id, source),
    };
  },
  [constants.UPDATE_CELL_OUTPUTS]: function updateOutputs(state, action) {
    mark('updateOutputs');
    const { id, outputs } = action;
    const { notebook } = state;
    return {
      ...state,
      notebook: commutable.updateOutputs(notebook, id, outputs),
    };
  },
  [constants.UPDATE_CELL_PAGERS]: function updateCellPagers(state, action) {
    mark('updateCellPagers');
    const { id, pagers } = action;
    const { cellPagers } = state;
    return {
      ...state,
      cellPagers: cellPagers.set(id, pagers),
    };
  },
  [constants.UPDATE_CELL_STATUS]: function updateCellStatus(state, action) {
    mark('updateCellStatus');
    const { id, status } = action;
    const { cellStatuses } = state;
    return {
      ...state,
      cellStatuses: cellStatuses.set(id, status),
    };
  },
  [constants.SET_LANGUAGE_INFO]: function setLanguageInfo(state, action) {
    mark('setLanguageInfo');
    const { langInfo } = action;
    const { notebook } = state;
    return {
      ...state,
      notebook: notebook.setIn(['metadata', 'language_info'], Immutable.fromJS(langInfo)),
    };
  },
  [constants.OVERWRITE_METADATA_FIELD]: function overwriteMetadata(state, action) {
    mark('overwriteMetadata');
    const { field, value } = action;
    const { notebook } = state;
    return {
      ...state,
      notebook: notebook.setIn(['metadata', field], Immutable.fromJS(value)),
    };
  },
  [constants.STARTED_UPLOADING]: noop,
  [constants.DONE_UPLOADING]: noop,
  [constants.SET_NOTIFICATION_SYSTEM]: function setNotificationsSystem(state, action) {
    mark('setNotificationsSystem');
    const { notificationSystem } = action;
    return {
      ...state,
      notificationSystem,
    };
  },
};
