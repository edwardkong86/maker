import React, {Component} from "react";
import {Alert, Picker, Platform, ScrollView, StyleSheet, View} from 'react-native';
import DatePicker from 'react-native-datepicker';
import * as Calendar from 'expo-calendar';
import * as Localization from 'expo-localization';
import * as Permissions from 'expo-permissions';
import {Button, Checkbox, IconToggle, Subheader, Toolbar} from 'react-native-material-ui';
import Spinner from '../../components/UI/Spinner/Spinner';
import Template from '../Template/Template';
import Input from '../../components/UI/Input/Input';
import ConfigCategory from '../ConfigCategory/ConfigCategory';
import Dialog from '../../components/UI/Dialog/Dialog';
import OtherRepeat from './OtherRepeat/OtherRepeat';
import {convertNumberToDate, generateDialogObject, valid} from '../../shared/utility';
import {fullWidth} from '../../shared/styles';
import {BannerAd} from "../../../adsAPI";
import moment from 'moment';

import {connect} from 'react-redux';
import * as actions from '../../store/actions/index';

class ConfigTask extends Component {
    state = {
        task: {
            id: false,
            name: '',
            description: '',
            date: '',
            repeat: 'noRepeat',
            category: '',
            priority: 'none',
            event_id: false
        },
        controls: {
            name: {
                label: 'Enter task name',
                required: true,
                characterRestriction: 40,
            },
            description: {
                label: 'Enter task description',
                multiline: true
            }
        },
        repeat: {
            noRepeat: {
                name: 'No repeat',
                value: 'noRepeat'
            },
            onceDay: {
                name: 'Once a Day',
                value: 'onceDay'
            },
            onceDayMonFri: {
                name: 'Once a Week (Mon-Fri)',
                value: 'onceDayMonFri'
            },
            onceDaySatSun: {
                name: 'Once a Week (Sat-Sun)',
                value: 'onceDaySatSun'
            },
            onceWeek: {
                name: 'Once a Week',
                value: 'onceWeek'
            },
            onceMonth: {
                name: 'Once a Month',
                value: 'onceMonth'
            },
            onceYear: {
                name: 'Once a Year',
                value: 'onceYear'
            }
        },
        dialog: null,
        otherOption: 'Other...',
        selectedTime: 0,
        repeatValue: '1',
        showOtherRepeat: false,
        showDialog: false,
        editTask: null,
        showConfigCategory: false,
        changedSth: false,
        setCalendarEvent: false,
        allDay: true,
        loading: true
    };

    componentDidMount() {
        const task = this.props.navigation.getParam('task', false);
        if (task !== false) this.initTask(task);
        else {
            const checkExistCategory = this.props.categories.filter(cate => cate.name === this.state.task.category);
            if (!checkExistCategory.length) {
                this.updateTask('category', this.props.categories[0].name);
            }
            this.setState({editTask: false, loading: false});
        }
    };

    initTask = (id) => {
        const {categories} = this.props;
        this.props.onInitTask(id, (task) => {
            let selectedTime = 0;
            let repeatValue = '1';
            let otherOption = 'Other...';

            if (+task.repeat === parseInt(task.repeat, 10)) {
                selectedTime = task.repeat[0];
                repeatValue = task.repeat.substring(1);
                otherOption = `Other (${+repeatValue} ${convertNumberToDate(+selectedTime)})`;
            }

            const checkExistCategory = categories.filter(cate => cate.name === task.category);
            if (!checkExistCategory.length) task.category = categories[0].name;

            this.setState({
                editTask: true, task,
                otherOption, repeatValue,
                setCalendarEvent: !!task.event_id,
                allDay: task.date.length < 13,
                selectedTime, loading: false
            });
        });
    };

    updateTask = (name, value) => {
        const task = this.state.task;
        if (task[name] + '' === value + '') return null;
        task[name] = value;
        this.setState({task, changedSth: true});
    };

    showDialog = (action) => {
        const {task} = this.state;
        let dialog;
        if (action === 'exit') {
            dialog = generateDialogObject(
                'Are you sure?',
                'Quit without saving?',
                {
                    Yes: () => {
                        this.setState({showDialog: false});
                        this.props.navigation.goBack();
                    },
                    Save: () => {
                        this.checkValid('name', true);
                        this.setState({showDialog: false});
                    },
                    Cancel: () => {
                        this.setState({showDialog: false});
                    }
                }
            );
        } else if (action === 'delete') {
            dialog = generateDialogObject(
                'Are you sure?',
                'Delete this task?',
                {
                    Yes: () => {
                        this.setState({showDialog: false});
                        this.props.onRemoveTask(task);
                        this.props.navigation.goBack();
                    },
                    Cancel: () => {
                        this.setState({showDialog: false});
                    }
                }
            );
        }
        this.setState({showDialog: true, dialog});
    };

    toggleConfigCategory = (category) => {
        const {showConfigCategory, task} = this.state;
        if (category) task.category = category.name;
        this.setState({showConfigCategory: !showConfigCategory});
    };

    updateRepeat = (repeat) => {
        if (repeat === this.state.otherOption) {
            this.setState({showOtherRepeat: true});
        } else {
            this.updateTask('repeat', repeat);
        }
    };

    saveOtherRepeat = () => {
        const {selectedTime, repeatValue} = this.state;
        const repeat = selectedTime + repeatValue;
        const otherOption = `Other (${repeatValue} ${convertNumberToDate(+selectedTime)})`;
        this.updateTask('repeat', repeat);
        this.setState({otherOption, showOtherRepeat: false});
    };

    checkValid = (name, save = false, value = this.state.task.name) => {
        const controls = this.state.controls;
        valid(controls, value, name, (newControls) => {
            this.updateTask(name, value);
            if (save && !newControls[name].error) {
                this.saveTask();
            }
            this.setState({controls: newControls});
        })
    };

    saveTask = () => {
        const {task} = this.state;
        const {navigation} = this.props;

        if (this.state.setCalendarEvent) {
            // Set event
            this.setCalendarEvent().then(() => {
                this.props.onSaveTask(task);
                navigation.goBack();
            })
        } else {
            if (!!task.event_id) {
                // Delete event
                Calendar.deleteEventAsync(task.event_id, {futureEvent: true}).then(() => {
                    task.event_id = false;
                    this.props.onSaveTask(task);
                    navigation.goBack();
                });
            } else {
                this.props.onSaveTask(task);
                navigation.goBack();
            }
        }
    };

    async setCalendarEvent(calendarId = false) {
        const {task, allDay} = this.state;
        const {theme} = this.props;

        // Set calendar event
        const {status} = await Permissions.askAsync('calendar');
        const calendars = await Calendar.getCalendarsAsync();
        if (status === 'granted' && Platform.OS !== 'ios') {
            // For android
            for (let i = 0; i < calendars.length; i++) {
                if (calendars[i].ownerAccount === 'Maker' && calendars[i].allowsModifications) {
                    calendarId = calendars[i].id
                }
            }
            if (!calendarId) {
                // Create new calendar
                const details = {
                    title: 'Maker - ToDo list',
                    color: theme.primaryColor,
                    source: {
                        isLocalAccount: true,
                        name: 'Maker'
                    },
                    name: 'Maker - ToDo list',
                    ownerAccount: 'Maker',
                    timeZone: Localization.timezone,
                    allowsModifications: true,
                    allowedAvailabilities: [Calendar.Availability.BUSY, Calendar.Availability.FREE, Calendar.Availability.TENTATIVE],
                    allowedReminders: [Calendar.AlarmMethod.ALARM, Calendar.AlarmMethod.ALERT, Calendar.AlarmMethod.EMAIL, Calendar.AlarmMethod.SMS, Calendar.AlarmMethod.DEFAULT],
                    allowedAttendeeTypes: [Calendar.AttendeeType.REQUIRED, Calendar.AttendeeType.NONE],
                    type: Calendar.EntityTypes.REMINDER,
                    isVisible: true,
                    isSynced: true,
                    accessLevel: Calendar.CalendarAccessLevel.ROOT
                };
                calendarId = await Calendar.createCalendarAsync(details);
            }
        } else if (Platform.OS === 'ios') {
            // For iOS # To Fix #
            const {statusIos} = await Permissions.askAsync('reminders');
            if (statusIos === 'granted') {
                for (let i = 0; i < calendars.length; i++) {
                    if (calendars[i].ownerAccount === 'Maker' && calendars[i].allowsModifications) {
                        calendarId = calendars[i].id
                    }
                }
                if (!calendarId) {
                    // Create new calendar
                    const details = {
                        title: 'Maker - ToDo list',
                        color: theme.primaryColor,
                        entityType: Calendar.EntityTypes.REMINDER,
                        sourceId: 'Maker',
                    };
                    calendarId = await Calendar.createCalendarAsync(details);
                }
            }
        }

        // Create event
        if (calendarId !== false) {
            let date;
            // Convert date
            if (allDay) {
                date = new Date(moment(task.date, 'DD-MM-YYYY').add(1, 'days').format());
            } else {
                date = new Date(moment(task.date, 'DD-MM-YYYY HH:mm').format());
            }

            const detailsEvent = {
                title: task.name,
                startDate: date,
                endDate: date,
                timeZone: Localization.timezone,
                notes: task.description,
                allDay
            };

            if (!!task.event_id) {
                // Update existed event
                console.log(task.event_id);
                Calendar.updateEventAsync(task.event_id, detailsEvent, {futureEvent: true});
            } else {
                task.event_id = await Calendar.createEventAsync(calendarId, detailsEvent);
                this.setState({task});
            }
        }
    }

    render() {
        const {
            task, changedSth, controls, loading, editTask,
            showConfigCategory, repeat, dialog, showDialog,
            otherOption, selectedTime, showOtherRepeat, repeatValue, setCalendarEvent
        } = this.state;
        const {navigation, categories, theme, settings} = this.props;
        let date;
        let now;

        if (task.date.length > 12) {
            date = moment(task.date, 'DD-MM-YYYY - HH:mm');
            now = new Date();
        } else {
            date = moment(task.date, 'DD-MM-YYYY');
            now = new Date().setHours(0, 0, 0, 0);
        }

        return (
            <Template>
                <Toolbar
                    leftElement="arrow-back"
                    rightElement={
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Button
                                text="Save"
                                style={{text: {color: theme.headerTextColor}}}
                                onPress={() => this.checkValid('name', true)}
                            />
                            {editTask && <IconToggle name="delete"
                                                     color={theme.headerTextColor}
                                                     onPress={() => this.showDialog('delete')}/>
                            }
                        </View>
                    }
                    onLeftElementPress={() => {
                        if (changedSth) this.showDialog('exit');
                        else navigation.goBack();
                    }}
                    centerElement={
                        !loading ?
                            editTask ?
                                "Edit task" :
                                "New task" :
                            <View style={{marginTop: 10}}>
                                <Spinner color={theme.secondaryBackgroundColor} size='small'/>
                            </View>
                    }
                />

                {showOtherRepeat &&
                <OtherRepeat
                    showModal={showOtherRepeat}
                    repeat={repeatValue}
                    selectedTime={selectedTime}
                    onSetRepeat={value => this.setState({repeatValue: value})}
                    onSelectTime={value => this.setState({selectedTime: value})}
                    save={this.saveOtherRepeat}
                    cancel={() => this.setState({showOtherRepeat: false})}
                />
                }
                {showConfigCategory &&
                <ConfigCategory
                    showModal={showConfigCategory}
                    category={false}
                    toggleModal={this.toggleConfigCategory}
                />
                }
                {showDialog &&
                <Dialog
                    showModal={showDialog}
                    title={dialog.title}
                    description={dialog.description}
                    buttons={dialog.buttons}
                />
                }

                {!loading ?
                    <ScrollView>
                        <Input
                            elementConfig={controls.name}
                            focus={!editTask}
                            value={task.name}
                            changed={(value) => {
                                this.checkValid('name', false, value)
                            }}/>
                        <Input
                            elementConfig={controls.description}
                            value={task.description}
                            changed={value => this.updateTask('description', value)}/>
                        <View style={styles.container}>
                            <Subheader text="Due date"
                                       style={{
                                           container: fullWidth,
                                           text: {color: theme.primaryColor}
                                       }}
                            />
                            <DatePicker
                                ref={(e) => this.datepickerDate = e}
                                style={{width: '100%'}}
                                date={task.date.slice(0, 10)}
                                mode="date"
                                iconComponent={
                                    task.date ?
                                        <IconToggle onPress={() => this.updateTask('date', '')} name='clear'/> :
                                        <IconToggle onPress={() => this.datepickerDate.onPressDate()} name='event'/>
                                }
                                placeholder="Select due date"
                                format="DD-MM-YYYY"
                                confirmBtnText="Confirm"
                                cancelBtnText="Cancel"
                                customStyles={{
                                    dateInput: [styles.datePicker, {borderColor: theme.primaryColor}],
                                    dateText: {
                                        color: +date < +now ? theme.overdueColor : theme.textColor
                                    }
                                }}
                                onDateChange={(date) => this.updateTask('date', date)}
                            />
                            {task.date !== '' &&
                            <React.Fragment>
                                <DatePicker
                                    ref={(e) => this.datepickerTime = e}
                                    style={{width: '100%'}}
                                    date={task.date.slice(13, 18)}
                                    is24Hour={!!settings.timeFormat}
                                    mode="time"
                                    iconComponent={
                                        task.date.slice(13, 18) ?
                                            <IconToggle onPress={() => {
                                                this.setState({allDay: true});
                                                this.updateTask('date', task.date.slice(0, 10))
                                            }}
                                                        name='clear'/> :
                                            <IconToggle onPress={() => this.datepickerTime.onPressDate()}
                                                        name='access-time'/>
                                    }
                                    placeholder="Select due time"
                                    format="HH:mm"
                                    confirmBtnText="Confirm"
                                    cancelBtnText="Cancel"
                                    customStyles={{
                                        dateInput: [styles.datePicker, {borderColor: theme.primaryColor}],
                                        dateText: {
                                            color: +date < +now ? theme.overdueColor : theme.textColor
                                        }
                                    }}
                                    onDateChange={(date) => {
                                        this.setState({allDay: false});
                                        this.updateTask('date', `${task.date.slice(0, 10)} - ${date}`);
                                    }}
                                />
                                <Checkbox
                                    label="Set calendar event"
                                    value='set'
                                    checked={setCalendarEvent}
                                    onCheck={(value) => this.setState({setCalendarEvent: value})}
                                />
                                <Subheader text="Repeat"
                                           style={{
                                               container: fullWidth,
                                               text: {color: theme.primaryColor}
                                           }}
                                />
                                <View style={styles.picker}>
                                    <Picker
                                        style={{color: theme.textColor}}
                                        selectedValue={
                                            repeat[task.repeat] ?
                                                repeat[task.repeat].value :
                                                otherOption
                                        }
                                        onValueChange={value => this.updateRepeat(value)}>
                                        {Object.keys(repeat).map(name => (
                                            <Picker.Item key={name}
                                                         label={repeat[name].name}
                                                         value={repeat[name].value}/>
                                        ))}
                                        <Picker.Item label={otherOption}
                                                     value={otherOption}/>
                                    </Picker>
                                </View>
                            </React.Fragment>
                            }
                            <Subheader text="Category"
                                       style={{
                                           container: fullWidth,
                                           text: {color: theme.primaryColor}
                                       }}
                            />
                            <View style={styles.selectCategory}>
                                <View style={styles.category}>
                                    <Picker
                                        style={{color: theme.textColor}}
                                        selectedValue={task.category}
                                        onValueChange={value => this.updateTask('category', value)}>
                                        {categories.map(cate => (
                                            <Picker.Item key={cate.id}
                                                         label={cate.name}
                                                         value={cate.name}/>
                                        ))}
                                    </Picker>
                                </View>
                                <IconToggle onPress={() => this.toggleConfigCategory()} name="playlist-add"/>
                            </View>
                            <Subheader text="Priority"
                                       style={{
                                           container: fullWidth,
                                           text: {color: theme.primaryColor}
                                       }}
                            />
                            <View style={styles.picker}>
                                <Picker
                                    style={{color: theme.textColor}}
                                    selectedValue={task.priority}
                                    onValueChange={value => this.updateTask('priority', value)}>
                                    <Picker.Item label="None" value="none"/>
                                    <Picker.Item label="Low" value="low"/>
                                    <Picker.Item label="Medium" value="medium"/>
                                    <Picker.Item label="High" value="high"/>
                                </Picker>
                            </View>
                        </View>
                    </ScrollView> : <Spinner/>
                }
                <BannerAd/>
            </Template>
        );
    }
}

const
    styles = StyleSheet.create({
        container: {
            paddingLeft: 20,
            paddingRight: 20,
            paddingBottom: 20,
            display: 'flex',
            alignItems: "center",
            justifyContent: "center"
        },
        datePicker: {
            marginRight: 5,
            marginLeft: 5,
            borderBottomWidth: 0.5,
            borderLeftWidth: 0,
            borderRightWidth: 0,
            borderTopWidth: 0
        },
        category: {
            width: '85%',
            height: 50,
            borderWidth: 0
        },
        selectCategory: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
        },
        picker: {
            width: '100%',
            height: 50,
            borderWidth: 0
        }
    });

const mapStateToProps = state => {
    return {
        categories: state.categories.categories,
        theme: state.theme.theme,
        settings: state.settings
    }
};
const mapDispatchToProps = dispatch => {
    return {
        onInitTask: (id, callback) => dispatch(actions.initTask(id, callback)),
        onSaveTask: (task) => dispatch(actions.saveTask(task)),
        onRemoveTask: (task) => dispatch(actions.removeTask(task, false)),
    }
};

export default connect(mapStateToProps, mapDispatchToProps)(ConfigTask);