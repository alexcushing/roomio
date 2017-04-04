import React, { Component, PropTypes } from 'react';
import Push from 'push.js';
import validator from 'validator';
import { connect } from 'react-redux';
import Scroll, { scroller, scrollToBottom } from 'react-scroll';
import { updateActiveTopic } from '../redux/ducks/activeDucks';
import { addTopic, addMessages, addMessage, viewAllMessages } from '../redux/ducks/entitiesDucks';
import { updateTopicPagination } from '../redux/ducks/paginationDucks';
import { startLoadingTopic, stopLoadingTopic } from '../redux/ducks/isLoadedDucks';
import { authGET } from '../shared/utils/authAxios';
import find from 'lodash/find';
import Loading from '../components/reusable/Loading';
const scroll = Scroll.animateScroll;

const scrollBottom = () => {
  scroll.scrollToBottom({
    containerId: 'fortopic',
    smooth: false,
    duration: 0,
    delay: 0
  });
}

// const scrollToTop = () => {
//   scroll.scrollToTop({
//     containerId: 'fortopic',
//     smooth: false,
//     duration: 0,
//     delay: 0
//   });
// }

/**
 * Components
 */
import Topic from '../components/Topic';

class TopicContainer extends Component {
  state = { content: '', unseenMessages: 0 };

  componentWillMount() {
    const { topics, socket, params: { topicRef, roomName } } = this.props;
    // check cache

    const topic = find(topics[roomName], { ref: topicRef });

    if (!topic) {
      // if not in the cache show spinner
      this.props.startLoading();
      this.props.updateTopicPagination(topicRef, {
        page: 1,
        loading: false,
        end: false,
      });
      scrollBottom();
    }

    this.props.fetchTopic(topicRef)
      .then(() => {
          this.props.initSocketListeners();
          this.props.emit.joinTopic();
          scrollBottom();
      }).catch((err) => console.log(err));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.setState({ unseenMessages: 0 });
        this.updateTitle();
      }
    });
  }

  componentDidMount() {
    scrollBottom();
  }

  componentWillUnmount() {
    this.props.emit.leaveTopic();
  }

  loadMore = () => {
    const { page, end, loading } = this.props.pagination;
    const { topicRef } = this.props.params;
    const messages = this.props.messages[topicRef];
    if (!end && !loading) {
      this.props.updateTopicPagination(topicRef, { loading: true });
      this.props.fetchMoreMessages(topicRef, page)
      .then((res) => {
        const lastMessage = res.data.messages.data.pop();
        console.log(`fetched page ${page}`);
        // console.log(`message - ${lastMessage.user.username} - message-${lastMessage.id}`);
        if (page !== 1) {
          scroller.scrollTo(`message-${lastMessage.id}`, {
            smooth: false,
            duration: 100,
            delay: 100,
            containerId: 'fortopic'
          });
        }
        this.props.updateTopicPagination(topicRef, {
          page: page+1,
          loading: false,
          end: res.data.messages.data.length === 0,
        });
      });
    }
  }

  componentWillReceiveProps(nextProps) {
    const { windowState,  params: { topicRef, roomName }, topics } = this.props;
    const newMessagesLen = nextProps.messages[topicRef] ? nextProps.messages[topicRef].length : 0;
    const currMessagesLen = this.props.messages[topicRef] ? this.props.messages[topicRef].length : 0;

    if (newMessagesLen > currMessagesLen) {
      const newMessage = nextProps.messages[topicRef][newMessagesLen - 1];

      if (!newMessage.seen && windowState === 'hidden') {
        const topic = find(topics[roomName], { ref: topicRef });
        this.setState({
          unseenMessages: this.state.unseenMessages + 1,
        });

        Push.create(`${newMessage.user.username} said: `, {
          body: newMessage.content || ' ',
          timeout: 5000,
          icon: {
            x16: 'http://i.imgur.com/X9LSYcX.png',
            x32: 'http://i.imgur.com/X9LSYcX.png',
          },
        });
      }
    }
  }

  updateTitle() {
    const { windowState, topics, params: { topicRef, roomName } } = this.props;
    const topic = find(topics[roomName], { ref: topicRef });

    if (this.state.unseenMessages > 0 && windowState === 'hidden' && topic) {
      const title = `(${this.state.unseenMessages}) - ${topic.room.title} - ${topic.title}`
      document.title = title;
    } else if (topic) {
      document.title = `${topic.room_name} - ${topic.title}`;
    }
  }

  onInputChange = (event) => {
    const { value: content } = event.target;
    this.setState({ content });
  }

  sendMessage = (event) => {
    if (event) event.preventDefault();
    const  content = Htmlspecialchars(this.state.content);
    this.props.emit.sendMessage(content);
    this.setState({ content: '' });
    scrollBottom();
  }

  render() {
    const { topics, isLoaded, messages } = this.props;
    const { roomName, topicRef } = this.props.params;

    this.updateTitle();

    const topic = find(topics[roomName], { ref: topicRef });

    if (isLoaded || topic) {
      return (
        <Topic
          topic={topic}
          messages={messages[topicRef]}
          onChange={this.onInputChange}
          sendMessage={this.sendMessage}
          content={this.state.content}
          loadMore={this.loadMore}
          {...this.props.pagination}
        />
      );
    }

    return (
      <Loading name="topic" />
    );
  }
}

const mapStateToProps = (state, props) => ({
  topics: state.entities.topics,
  messages: state.entities.messages,
  active: state.active,
  isLoaded: state.isLoaded.topics[props.params.topicRef],
  pagination: state.pagination.topics[props.params.topicRef],
  windowState: state.active.window,
});

const mapDispatchToProps = (dispatch, props) => {
  const { socket, params } = props;

  return {
    initSocketListeners: () => {
      socket.on('topic:new_message', ({ message }) => {
        dispatch(addMessage(message.topic_ref, message));
        scrollBottom();
      });
    },
    emit: {
      joinTopic: () => {
        const { topicRef, roomName } = params;
        socket.emit('topic:join', { topicRef, roomName });
      },
      leaveTopic: () => {
        const { topicRef, roomName } = params;
        socket.emit('topic:leave', { topicRef, roomName });
      },
      sendMessage: (content) => {
        const { topicRef, roomName } = params;
        socket.emit('topic:send_message', {
          content, 
          topic_ref: topicRef, 
          ...window.user,
        });
      },
    },
    viewAllMessages: () => dispatch(viewAllMessages(params.topic_ref)),
    startLoading: () => dispatch(startLoadingTopic(params.topicRef)),
    updateTopicPagination: (topicRef, pagination) => dispatch(updateTopicPagination(topicRef, pagination)),
    fetchTopic: (topicRef) => {
      return new Promise((resolve, reject) => {
        authGET(`/api/topic/${topicRef}/messages`)
          .then((res) => {
            const { messages, topic } = res.data;
            dispatch(
              updateTopicPagination(params.topicRef, {
                end: messages.data.length < 50,
                loading: false,
              })
            );
            dispatch(addTopic(topic));
            dispatch(addMessages(topic.ref, messages.data));
            dispatch(updateActiveTopic(topic.ref));
            dispatch(stopLoadingTopic(params.topicRef));

            document.title = `${topic.room_name} - ${topic.title}`;
            resolve(res);
          })
          .catch((err) => {
            console.log(err);
            dispatch(stopLoadingTopic(params.topicRef));
            reject(err);
          });
      })
    },
    fetchMoreMessages: (topicRef, page) => {
      return new Promise((resolve, reject) => {
        authGET(`/api/message/topic/${topicRef}?page=${page}`)
          .then((res) => {
            const { messages } = res.data;
            dispatch(addMessages(topicRef, messages.data));
            dispatch(
              updateTopicPagination(params.topicRef, {
                end: messages.data.length < 50,
                loading: false,
              })
            );
            resolve(res);
          })
          .catch((err) => {
            reject(err);
          });
      })
    },
  }
};

const ConnectedTopicContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(TopicContainer);

const Htmlspecialchars = (str) => {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    };
    return str.replace(/[&<>"']/g, m => map[m]);
}


export default ConnectedTopicContainer;