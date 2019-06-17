import * as actionTypes from '../actions/actionTypes';
import {updateObject} from '../../shared/utility';

const initState = {
    task: {
        id: false,
        name: '',
        description: '',
        date: '',
        repeat: 'noRepeat',
        category: '',
        priority: 'none',
    },
    tasks: [],
    finished: [],
    refresh: false
};

const initToDo = (state, action) => {
    return updateObject(state,{
        tasks: action.tasks,
        finished: action.finished,
        refresh: !state.refresh
    });
};

const initTasks = (state, action) => {
    return updateObject(state,{
        tasks: action.tasks,
        refresh: !state.refresh
    });
};

const initFinished = (state, action) => {
    return updateObject(state,{
        finished: action.tasks,
        refresh: !state.refresh
    });
};

const changeName = (state, action) => {
    return updateObject(state,{
        task: {
            ...state.task,
            name: action.name,
        }
    });
};

const changeDescription = (state, action) => {
    return updateObject(state,{
        task: {
            ...state.task,
            description: action.description
        }
    });
};

const changeDate = (state, action) => {
    return updateObject(state,{
        task: {
            ...state.task,
            date: action.date
        }
    });
};

const changeCategory = (state, action) => {
    return updateObject(state,{
        task: {
            ...state.task,
            category: action.category
        }
    });
};

const changePriority = (state, action) => {
    return updateObject(state,{
        task: {
            ...state.task,
            priority: action.priority
        }
    });
};

const changeRepeat = (state, action) => {
    return updateObject(state,{
        task: {
            ...state.task,
            repeat: action.repeat
        }
    });
};

const setTask = (state, action) => {
    return updateObject(state,{
        task: action.task
    });
};

const defaultTask = (state) => {
    return updateObject(state,{
        task: {
            id: false,
            name: '',
            description: '',
            date: '',
            repeat: 'noRepeat',
            category: '',
            priority: 'none'
        }
    });
};

const reducer = (state = initState, action) => {
    switch (action.type) {
        case actionTypes.INIT_TODO: return initToDo(state, action);
        case actionTypes.INIT_TASKS: return initTasks(state, action);
        case actionTypes.INIT_FINISHED: return initFinished(state, action);
        case actionTypes.CHANGE_TASK_NAME: return changeName(state, action);
        case actionTypes.CHANGE_TASK_DESCRIPTION: return changeDescription(state, action);
        case actionTypes.CHANGE_TASK_DATE: return changeDate(state, action);
        case actionTypes.CHANGE_TASK_CATEGORY: return changeCategory(state, action);
        case actionTypes.CHANGE_TASK_PRIORITY: return changePriority(state, action);
        case actionTypes.CHANGE_TASK_REPEAT: return changeRepeat(state, action);
        case actionTypes.SET_TASK: return setTask(state, action);
        case actionTypes.DEFAULT_TASK: return defaultTask(state);
        default: return state;
    }
};

export default reducer;