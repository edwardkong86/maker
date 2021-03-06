import * as actionTypes from './actionTypes';

export const updateModal = (showModal, modal) => {
    return {
        type: actionTypes.UPDATE_MODAL,
        showModal, modal
    }
};

export const updateSnackbar = (showSnackbar, snackbarText) => {
    return {
        type: actionTypes.UPDATE_SNACKBAR,
        showSnackbar, snackbarText
    }
};