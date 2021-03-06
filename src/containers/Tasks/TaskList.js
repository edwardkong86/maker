import React, {Component} from 'react';
import {
    Animated,
    AsyncStorage,
    Easing,
    FlatList,
    Platform,
    RefreshControl,
    Text,
    TouchableHighlight,
    View
} from 'react-native';
import {ActionButton, BottomNavigation, Icon, IconToggle, ListItem, Subheader, Toolbar} from 'react-native-material-ui';
import {generateDialogObject, sortingByType} from '../../shared/utility';
import {empty, shadow} from '../../shared/styles';
import ModalDropdown from 'react-native-modal-dropdown';
import ConfigCategory from "../Categories/ConfigCategory/ConfigCategory";
import Spinner from '../../components/UI/Spinner/Spinner';
import styles from './TaskList.styles';
import moment from 'moment';

import {connect} from 'react-redux';
import * as actions from "../../store/actions";

const UP = 1;
const DOWN = -1;

class TaskList extends Component {
    state = {
        priorityColors: {
            none: {bgColor: this.props.theme.secondaryBackgroundColor},
            low: {bgColor: this.props.theme.lowColor},
            medium: {bgColor: this.props.theme.mediumColor},
            high: {bgColor: this.props.theme.highColor},
        },
        selectedTask: null,
        showConfigCategory: false,

        scroll: 0,
        offset: 0,
        scrollDirection: 0,
        bottomHidden: false,

        tasks: [],
        data: [],
        visibleData: 8,
        dropdownData: null,
        selectedCategory: {id: -1, name: this.props.translations.all},
        selectedIndex: 0,
        searchText: '',
        rotateAnimated: new Animated.Value(0),
        rotateInterpolate: '0deg',
        animations: {},
        loading: true
    };

    componentDidMount() {
        this.checkUpdate();
        this.selectedCategoryHandler();
        this.renderDropdownData();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (prevProps.theme !== this.props.theme) {
            this.refreshPriorityColors();
        }
        if (prevProps.refresh !== this.props.refresh) {
            this.refreshComponent(this.state.visibleData);
        }
        if (prevProps.categories.length !== this.props.categories.length) {
            this.renderDropdownData();
        }
        if (prevProps.tasks !== this.props.tasks ||
            prevProps.finished !== this.props.finished) {
            this.selectedCategoryHandler();
        }
        if (prevProps.sorting !== this.props.sorting ||
            prevProps.sortingType !== this.props.sortingType) {
            this.divisionTask();
        }
    }

    checkUpdate = async () => {
        const updated = await AsyncStorage.getItem('updated');
        if (updated !== null) {
            this.showDialog('updated');
            AsyncStorage.removeItem('updated');
        }
    };

    onScroll = (e) => {
        const currentOffset = e.nativeEvent.contentOffset.y;
        const sub = this.state.offset - currentOffset;

        if (sub > -10 && sub < 10) return;
        this.state.offset = e.nativeEvent.contentOffset.y;

        const currentDirection = sub > 0 ? UP : DOWN;

        if (this.state.scrollDirection !== currentDirection) {
            this.setState({
                scrollDirection: currentDirection,
                bottomHidden: currentDirection === DOWN
            });
        }
    };

    rotate = (value) => {
        const {rotateAnimated} = this.state;
        Animated.timing(rotateAnimated, {
            toValue: value,
            duration: 250,
            easing: Easing.bezier(0.0, 0.0, 0.2, 1),
            useNativeDriver: Platform.OS === 'android',
        }).start();

        const rotateInterpolate = rotateAnimated.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '180deg']
        });

        this.setState({rotateInterpolate});
    };

    moveAnimate = (callback = () => null) => {
        const {animations} = this.state;
        animations[`move${this.state.selectedTask.id}`] = new Animated.Value(0);
        this.setState({animations}, () => {
            Animated.timing(
                this.state.animations[`move${this.state.selectedTask.id}`],
                {
                    toValue: -400,
                    duration: 350,
                    easing: Easing.bezier(0.0, 0.0, 0.2, 1),
                    useNativeDriver: false
                }
            ).start(() => {
                animations[`hide${this.state.selectedTask.id}`] = true;
                this.setState({animations}, callback());
            });
        })
    };

    refreshPriorityColors = () => {
        this.setState({
            priorityColors: {
                none: {bgColor: this.props.theme.secondaryBackgroundColor},
                low: {bgColor: this.props.theme.lowColor},
                medium: {bgColor: this.props.theme.mediumColor},
                high: {bgColor: this.props.theme.highColor}
            }
        })
    };

    showDialog = (action) => {
        const {translations} = this.props;
        let dialog;
        if (action === 'repeat') {
            dialog = generateDialogObject(
                translations.repeatTitle,
                translations.repeatDescription,
                {
                    [translations.yes]: () => {
                        this.props.onUpdateModal(false);
                        this.moveAnimate(() => {
                            const {selectedTask} = this.state;
                            this.props.onFinishTask(selectedTask, false, this.props.theme.primaryColor, () => {
                                this.props.onAddEndedTask();
                                const {animations} = this.state;
                                animations[`move${selectedTask.id}`] = new Animated.Value(0);
                                animations[`hide${selectedTask.id}`] = false;
                                this.setState({animations});
                            })
                        });
                    },
                    [translations.no]: () => {
                        this.props.onUpdateModal(false);
                        this.moveAnimate(() => {
                            this.props.onFinishTask(this.state.selectedTask, true, this.props.theme.primaryColor, () => {
                                this.props.onAddEndedTask();
                            })
                        });
                    },
                    [translations.cancel]: () => this.props.onUpdateModal(false)
                }
            );
        } else if (action === 'finish') {
            dialog = generateDialogObject(
                translations.defaultTitle,
                translations.finishDescription,
                {
                    [translations.yes]: () => {
                        this.props.onUpdateModal(false);
                        this.moveAnimate(() => {
                            this.props.onFinishTask(this.state.selectedTask, true, this.props.theme.primaryColor, () => {
                                this.props.onAddEndedTask();
                            });
                        });
                    },
                    [translations.no]: () => this.props.onUpdateModal(false)
                }
            );
        } else if (action === 'delete') {
            dialog = generateDialogObject(
                translations.defaultTitle,
                translations.deleteDescription,
                {
                    [translations.yes]: () => {
                        this.props.onUpdateModal(false);
                        this.moveAnimate(() => {
                            this.props.onRemoveTask(this.state.selectedTask);
                        });
                    },
                    [translations.no]: () => this.props.onUpdateModal(false)
                }
            );
        } else if (action === 'deleteAll') {
            dialog = generateDialogObject(
                translations.defaultAllTitle,
                translations.finishAllDescription,
                {
                    [translations.yes]: () => {
                        this.props.onUpdateModal(false);
                        this.deleteAllTask();
                    },
                    [translations.no]: () => {
                        this.props.onUpdateModal(false);
                    },
                }
            );
        } else if (action === 'updated') {
            dialog = generateDialogObject(
                translations.updatedTitle,
                `${translations.updatedDescription1}\n${translations.updatedDescription2}`,
                {
                    [translations.cancel]: () => {
                        this.props.onUpdateModal(false);
                    },
                }
            );
        }

        this.props.onUpdateModal(true, dialog);
    };

    checkTaskRepeatHandler = (task) => {
        if (task.repeat !== 'noRepeat') {
            if (!!this.props.settings.confirmRepeatingTask) {
                this.showDialog('repeat');
            } else {
                this.moveAnimate(() => {
                    this.props.onFinishTask(task, false, this.props.theme.primaryColor, () => {
                        this.props.onAddEndedTask();
                    });
                })
            }
        } else {
            if (!!this.props.settings.confirmFinishingTask) {
                this.showDialog('finish');
            } else {
                this.moveAnimate(() => {
                    this.props.onFinishTask(task, false, this.props.theme.primaryColor);
                })
            }
        }
    };

    deleteAllTask = () => {
        const {finished} = this.props;
        finished.map(task => {
            return this.props.onRemoveTask(task);
        });
    };

    checkDeleteHandler = () => {
        if (!!this.props.settings.confirmDeletingTask) {
            this.showDialog('delete');
        } else {
            this.moveAnimate(() => {
                this.props.onRemoveTask(this.state.selectedTask);
            })
        }
    };

    undoTask = (task) => {
        this.moveAnimate(() => {
            this.props.onUndoTask(task);
        })
    };

    setSortingType = (key) => {
        if (key === this.props.sorting) {
            if (this.props.sortingType === 'ASC') {
                this.props.onChangeSorting(key, 'DESC');
            } else {
                this.props.onChangeSorting(key, 'ASC');
            }
        } else {
            this.props.onChangeSorting(key, 'ASC');
        }
    };

    divisionTask = (
        tasks = this.state.tasks,
        visibleData = this.state.visibleData) => {
        const {sorting, sortingType, translations} = this.props;
        const division = {
            [translations.overdue]: [],
            [translations.today]: [],
            [translations.tomorrow]: [],
            [translations.thisWeek]: [],
            [translations.nextWeek]: [],
            [translations.thisMonth]: [],
            [translations.nextMonth]: [],
            [translations.later]: [],
            [translations.other]: [],
            [translations.finished]: []
        };

        tasks && Promise.all(tasks.map(task => {
            let div;
            if (task.finish) {
                div = translations.finished;
                return division[div].push(task);
            } else {
                div = this.getDateDivision(task.date);
                return division[div].push(task);
            }
        })).then(() => {
            const data = [];
            Object.keys(division)
                .map(div => {
                    return sortingByType(division[div], sorting, sortingType)
                        .map((task, index) => {
                            data.push({task, div, showDiv: index === 0});
                        })
                });

            if (visibleData < this.state.visibleData) {
                this.setState({data, tasks, visibleData, animations: {}, loading: false});
            } else {
                this.setState({data, tasks, animations: {}, loading: false});
            }
        });
    };

    getDateDivision = (date) => {
        const {translations} = this.props;
        let text;
        let now;
        if (!date) {
            text = translations.other;
            return text;
        } else {
            if (date.length > 12) {
                date = moment(date, 'DD-MM-YYYY - HH:mm');
                now = new Date();
            } else {
                date = moment(date, 'DD-MM-YYYY');
                now = new Date().setHours(0, 0, 0, 0);
            }
        }

        let week = 'week';
        if (this.props.settings.firstDayOfWeek === 'Monday') week = 'isoWeek';

        if (+date < +now) text = translations.overdue;
        else if (+date <= moment(now).endOf("day")) text = translations.today;
        else if (+date <= +moment(now).add(1, 'days').endOf("day")) text = translations.tomorrow;
        else if (date <= moment(now).endOf(week)) text = translations.thisWeek;
        else if (+date <= +moment(now).add(1, 'week').endOf(week)) text = translations.nextWeek;
        else if (date <= moment(now).endOf("month")) text = translations.thisMonth;
        else if (date <= moment(now).add(1, 'month').endOf("month")) text = translations.nextMonth;
        else text = translations.later;

        return text;
    };

    loadNextData = () => {
        const {visibleData, data} = this.state;
        if (visibleData < data.length) {
            this.setState({visibleData: visibleData + 8});
        }
    };

    toggleConfigCategory = () => {
        const {showConfigCategory} = this.state;
        this.setState({showConfigCategory: !showConfigCategory});
    };

    convertTimeCycle = (date) => {
        const allDay = date.length < 13;

        if (allDay) return date;
        else {
            if (!!this.props.settings.timeFormat) {
                return date;
            } else {
                return moment(date, 'DD-MM-YYYY - HH:mm').format('DD-MM-YYYY - hh:mm A');
            }
        }
    };

    selectedCategoryHandler = (
        category = this.state.selectedCategory,
        index = this.state.selectedIndex) => {
        const {tasks, finished, translations} = this.props;

        let filterTask = tasks;
        if (category.name === translations.finished) {
            filterTask = finished;
        } else if (category.name === translations.newCategory) {
            return this.toggleConfigCategory();
        } else if (category.name !== translations.all) {
            filterTask = tasks.filter(task => task.category.id === category.id);
        }

        if (category !== this.state.selectedCategory) {
            this.flatList.scrollToIndex({animated: false, index: 0});
            this.setState({
                selectedCategory: category,
                selectedIndex: +index
            }, () => this.divisionTask(filterTask, 8));
        } else {
            this.setState({
                selectedCategory: category,
                selectedIndex: +index
            }, () => this.divisionTask(filterTask));
        }
    };

    renderDropdownData = () => {
        const {categories, translations} = this.props;
        if (!categories.length) return null;
        const dropdownData = [];
        const all = {
            id: -1,
            name: translations.all
        };
        const finish = {
            id: -2,
            name: translations.finished
        };
        const newCate = {
            id: -3,
            name: translations.newCategory
        };
        dropdownData.push(all, ...categories, finish, newCate);
        this.setState({dropdownData});
    };

    dropdownRenderRow(rowData) {
        const {selectedCategory} = this.state;
        const {tasks, finished, theme} = this.props;
        let data;
        if (rowData.id === -3) {
            data = {
                icon: 'playlist-add',
                amount: false,
                bgColor: theme.secondaryBackgroundColor
            };
        } else if (rowData.id === -1)
            data = {
                icon: 'dehaze',
                amount: tasks.length,
                bgColor: theme.primaryBackgroundColor
            };
        else if (rowData.id === -2)
            data = {
                icon: 'done',
                amount: finished.length,
                bgColor: theme.primaryBackgroundColor
            };
        else {
            const amountOfTasks = tasks.filter(task => task.category.id === rowData.id);
            data = {
                icon: 'bookmark-border',
                amount: amountOfTasks.length,
                bgColor: theme.primaryBackgroundColor
            };
        }

        return (
            <TouchableHighlight underlayColor={theme.primaryColor}>
                <View style={[styles.dropdownRow, {backgroundColor: data.bgColor}]}>
                    <Icon name={data.icon}
                          style={styles.dropdownIcon}
                          color={selectedCategory.id === rowData.id ?
                              theme.primaryColor :
                              theme.thirdTextColor}/>
                    <Text style={[styles.dropdownRowText,
                        selectedCategory.id === rowData.id ?
                            {color: theme.primaryColor} :
                            {color: theme.thirdTextColor}]}>
                        {rowData.name}
                    </Text>
                    <Text style={[styles.dropdownRowText,
                        selectedCategory.id === rowData.id ?
                            {color: theme.primaryColor} :
                            {color: theme.thirdTextColor}]}>
                        {data.amount ? `(${data.amount})` : ''}
                    </Text>
                </View>
            </TouchableHighlight>
        );
    };

    updateTask = (task, action = null) => {
        this.setState({selectedTask: task}, () => {
            if (action === 'delete') {
                this.checkDeleteHandler();
            } else {
                if (task.finish) {
                    this.undoTask(task);
                } else {
                    this.checkTaskRepeatHandler(task);
                }
            }
        })
    };

    refreshComponent = (visibleData = 8) => {
        this.props.onInitToDo((tasks, finished) => {
            const {selectedCategory} = this.state;
            const {translations} = this.props;
            let filterTask = tasks;

            if (selectedCategory === translations.finished) {
                filterTask = finished;
            } else if (selectedCategory === translations.newCategory) {
                return this.toggleConfigCategory();
            } else if (selectedCategory !== translations.all) {
                filterTask = tasks.filter(task => task.category === selectedCategory);
            }

            this.renderDropdownData();
            this.divisionTask(filterTask, visibleData);
        })
    };

    renderTaskList = ({task, div, showDiv}) => {
        const {priorityColors} = this.state;
        const {translations, theme, navigation} = this.props;

        const moveValue = this.state.animations[`move${task.id}`] ?
            this.state.animations[`move${task.id}`] : 0;
        const hideTask = this.state.animations[`hide${task.id}`] ?
            0 : 'auto';

        // Searching system
        const searchText = this.state.searchText.toLowerCase();
        if (searchText.length > 0 && task.name.toLowerCase().indexOf(searchText) < 0) {
            if (task.description.toLowerCase().indexOf(searchText) < 0) {
                if (task.category.name.toLowerCase().indexOf(searchText) < 0) {
                    return null;
                }
            }
        }

        return (
            <View>
                {showDiv &&
                <Subheader
                    text={div}
                    style={{
                        text: div === translations.overdue ?
                            {color: theme.warningColor} :
                            {color: theme.thirdTextColor}
                    }}
                />
                }
                <Animated.View style={{height: hideTask, left: moveValue}}>
                    <View style={{marginLeft: 15, marginRight: 15, marginBottom: 15}}>
                        <ListItem
                            divider
                            dense
                            onPress={() => task.finish ?
                                null : navigation.navigate('ConfigTask', {task: task.id})}
                            style={{
                                container: {
                                    ...shadow,
                                    height: 80,
                                    backgroundColor: theme.primaryBackgroundColor
                                },
                                leftElementContainer: {
                                    marginRight: -50
                                }
                            }}
                            leftElement={
                                <View style={{
                                    marginLeft: -20,
                                    width: 15,
                                    height: '100%',
                                    backgroundColor: priorityColors[task.priority].bgColor
                                }}/>
                            }
                            centerElement={
                                <View>
                                    <Text numberOfLines={1} style={{
                                        margin: 2, fontSize: 17,
                                        color: theme.secondaryTextColor
                                    }}>
                                        {task.name}
                                    </Text>
                                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                        <Text numberOfLines={1} style={{
                                            margin: 2,
                                            fontWeight: '500',
                                            color: task.finished ?
                                                theme.thirdTextColor :
                                                div === translations.overdue ?
                                                    theme.warningColor :
                                                    theme.thirdTextColor
                                        }}>
                                            {task.date ? this.convertTimeCycle(task.date) : task.description ? task.description : ' '}
                                        </Text>
                                        {task.repeat !== 'noRepeat' &&
                                        <Icon
                                            size={16} color={theme.thirdTextColor}
                                            style={{alignSelf: 'center'}}
                                            name="autorenew"/>
                                        }
                                    </View>
                                    <Text numberOfLines={1} style={{
                                        margin: 2,
                                        color: theme.thirdTextColor
                                    }}>
                                        {task.category ? task.category.name : ' '}
                                    </Text>
                                </View>
                            }
                            rightElement={
                                <View style={styles.rightElements}>
                                    <IconToggle
                                        color={task.finish ?
                                            theme.undoIconColor :
                                            theme.doneIconColor
                                        }
                                        style={{
                                            container: {
                                                marginRight: task.finish ? -10 : 5
                                            }
                                        }}
                                        size={32}
                                        name={task.finish ? 'replay' : 'done'}
                                        onPress={() => this.updateTask(task)}
                                    />
                                    {task.finish &&
                                    <IconToggle
                                        onPress={() => this.updateTask(task, 'delete')}
                                        name="delete"
                                        color={theme.warningColor}
                                        size={28}
                                    />}
                                </View>
                            }
                        />
                    </View>
                </Animated.View>
            </View>
        )
    };

    render() {
        const {
            showConfigCategory, dropdownData, selectedIndex, data, visibleData,
            rotateInterpolate, bottomHidden, selectedCategory, loading
        } = this.state;
        const {theme, navigation, sortingType, sorting, finished, translations} = this.props;

        return (
            <View style={{flex: 1}}>
                <Toolbar
                    searchable={{
                        autoFocus: true,
                        placeholder: translations.search,
                        onChangeText: value => this.setState({searchText: value}),
                        onSearchClosed: () => this.setState({searchText: ''})
                    }}
                    leftElement="menu"
                    onLeftElementPress={() => navigation.navigate('Drawer')}
                    centerElement={
                        <ModalDropdown
                            ref={e => this.dropdown = e}
                            style={styles.dropdown}
                            textStyle={styles.dropdownText}
                            dropdownStyle={styles.dropdownDropdown}
                            defaultValue={selectedCategory.name}
                            defaultIndex={selectedIndex}
                            options={dropdownData}
                            onDropdownWillShow={() => this.rotate(1)}
                            onDropdownWillHide={() => this.rotate(0)}
                            onSelect={(index, item) => {
                                this.selectedCategoryHandler(item, index);
                            }}
                            renderButtonText={(rowData) => rowData.name}
                            renderRow={this.dropdownRenderRow.bind(this)}
                        >
                            <View style={styles.dropdownButton}>
                                <Text style={[styles.dropdownText, {
                                    color: theme.primaryTextColor,
                                    fontWeight: '500'
                                }]}>
                                    {selectedCategory.name}
                                </Text>
                                <Animated.View style={{transform: [{rotate: rotateInterpolate}]}}>
                                    <Icon
                                        style={styles.dropdownButtonIcon}
                                        color={theme.primaryTextColor}
                                        name="expand-more"/>
                                </Animated.View>
                            </View>
                        </ModalDropdown>
                    }
                />

                <ConfigCategory
                    category={false}
                    showModal={showConfigCategory}
                    toggleModal={this.toggleConfigCategory}
                />

                <FlatList
                    ref={e => this.flatList = e}
                    keyboardShouldPersistTaps="always"
                    keyboardDismissMode="interactive"
                    onScroll={this.onScroll}
                    scrollEventThrottle={16}

                    refreshControl={
                        <RefreshControl
                            refreshing={loading}
                            tintColor={theme.primaryColor}
                            onRefresh={this.refreshComponent}/>
                    }
                    ListEmptyComponent={
                        <Text style={[empty, {color: theme.thirdTextColor}]}>
                            {translations.emptyList}
                        </Text>
                    }
                    data={data.filter((d, i) => i <= visibleData)}
                    initialNumToRender={8}
                    onEndReachedThreshold={0.2}
                    onEndReached={this.loadNextData}
                    renderItem={({item}) => this.renderTaskList(item)}
                    keyExtractor={item => item.id}
                    onRefresh={this.refreshComponent}
                    refreshing={loading}
                    ListFooterComponent={data.length > visibleData && <Spinner/>}
                />

                <View>
                    {selectedCategory.name !== translations.finished ?
                        <ActionButton
                            hidden={bottomHidden}
                            onPress={() => navigation.navigate('ConfigTask', {category: selectedCategory})}
                            icon="add"
                            style={{
                                container: {backgroundColor: theme.warningColor},
                                icon: {color: theme.primaryTextColor}
                            }}
                        /> :
                        finished.length ?
                            <ActionButton
                                hidden={bottomHidden}
                                style={{
                                    container: {backgroundColor: theme.warningColor},
                                    icon: {color: theme.primaryTextColor}
                                }}
                                onPress={() => this.showDialog('deleteAll')}
                                icon="delete-sweep"
                            /> : null
                    }
                </View>
                <BottomNavigation
                    style={{container: {backgroundColor: theme.primaryBackgroundColor}}}
                    hidden={bottomHidden}
                    active={sorting}>
                    <BottomNavigation.Action
                        key="byAZ"
                        style={{label: {fontSize: 13}}}
                        icon="format-line-spacing"
                        label={sortingType === 'ASC' ? "A-Z" : "Z-A"}
                        onPress={() => this.setSortingType('byAZ')}
                    />
                    <BottomNavigation.Action
                        key="byDate"
                        style={{label: {fontSize: 13}}}
                        icon="insert-invitation"
                        label={translations.date}
                        onPress={() => this.setSortingType('byDate')}
                    />
                    <BottomNavigation.Action
                        key="byCategory"
                        style={{label: {fontSize: 13}}}
                        icon="bookmark-border"
                        label={translations.category}
                        onPress={() => this.setSortingType('byCategory')}
                    />
                    <BottomNavigation.Action
                        key="byPriority"
                        style={{label: {fontSize: 13}}}
                        icon="priority-high"
                        label={translations.priority}
                        onPress={() => this.setSortingType('byPriority')}
                    />
                </BottomNavigation>
            </View>
        )
    }
}

const mapStateToProps = state => {
    return {
        sorting: state.settings.settings.sorting,
        sortingType: state.settings.settings.sortingType,
        theme: state.theme.theme,
        settings: state.settings.settings,
        tasks: state.tasks.tasks,
        finished: state.tasks.finished,
        categories: state.categories.categories,
        showModal: state.config.showModal,
        refresh: state.tasks.refresh,
        translations: {
            ...state.settings.translations.TaskList,
            ...state.settings.translations.common
        }
    }
};

const mapDispatchToProps = (dispatch) => {
    return {
        onInitToDo: (callback) => dispatch(actions.initToDo(callback)),
        onFinishTask: (task, endTask, primaryColor, translations, callback) => dispatch(actions.finishTask(task, endTask, primaryColor, translations, callback)),
        onRemoveTask: (task) => dispatch(actions.removeTask(task)),
        onUndoTask: (task) => dispatch(actions.undoTask(task)),
        onAddEndedTask: () => dispatch(actions.addEndedTask()),
        onChangeSorting: (sorting, type) => dispatch(actions.changeSorting(sorting, type)),
        onUpdateModal: (showModal, modal) => dispatch(actions.updateModal(showModal, modal))
    }
};

export default connect(mapStateToProps, mapDispatchToProps)(TaskList);