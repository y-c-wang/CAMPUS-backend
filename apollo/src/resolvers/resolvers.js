const {
  tagResolvers,
  statusResolvers,
  userResolvers,
  coordinateResolvers,
  pageResolvers,
} = require('./map_resolvers');

/**
 * @typedef {import('../types').ResolverArgsInfo} ResolverArgsInfo
 * @typedef {import('../types').AddTagDataInput} AddTagDataInput
 * @typedef {import('../types').UpdateTagDataInput} UpdateTagDataInput
 * @typedef {import('../types').PageParams} PageParams
 * @typedef {import(../CampusPubSub)} PubSub
 */

const queryResolvers = {
  Query: {
    /**
     * @param {*} _
     * @param {{pageParams: PageParams}} params
     * @param {ResolverArgsInfo} info
     */
    unarchivedTagList: async (_, { pageParams }, { dataSources, userInfo }) => {
      const data = await dataSources.tagDataSource.getAllUnarchivedTags(
        pageParams
      );
      // Record user activity after the above function successfully return with
      // no errors.
      await dataSources.tagDataSource.recordUserActivity('getTags', userInfo);
      return data;
    },
    /**
     * @param {*} _
     * @param {{tagId: string}} params
     * @param {ResolverArgsInfo} info
     */
    tag: async (_, { tagId }, { dataSources }) =>
      dataSources.tagDataSource.getTagData({ tagId }),
    /**
     * @param {*} _
     * @param {{uid: string, pageParams: PageParams}} params
     * @param {ResolverArgsInfo} info
     */
    userAddTagHistory: async (_, { uid, pageParams }, { dataSources }) =>
      dataSources.tagDataSource.getUserAddTagHistory({ uid, pageParams }),
    /**
     * @param {*} _
     * @param {*} __
     * @param {ResolverArgsInfo} info
     */
    hasReadGuide: async (_, __, { dataSources, userInfo }) =>
      dataSources.userDataSource.getHasReadGuideStatus({ userInfo }),
    /**
     * @param {*} _
     * @param {*} __
     * @param {ResolverArgsInfo} info
     */
    archivedThreshold: async (_, __, { dataSources }) =>
      dataSources.tagDataSource.archivedThreshold,
    /**
     *
     * @param {*} _
     * @param {{uid: string}} param
     * @param {*} __
     * @returns
     */
    getUserData: async (_, { uid }, __) => ({ uid }),
  },
};

const mutationResolvers = {
  Mutation: {
    /**
     * @param {*} _
     * @param {{data: AddTagDataInput}} param
     * @param {ResolverArgsInfo} info
     */
    addNewTagData: async (_, { data }, { dataSources, userInfo }) => {
      const { tag, imageUploadNumber } =
        await dataSources.tagDataSource.addNewTagData({ data, userInfo });
      const imageUploadUrls = Promise.all(
        dataSources.storageDataSource.getImageUploadUrls({
          imageUploadNumber,
          tagId: tag.id,
        })
      );

      // increment userAddTagNumber
      const { uid } = userInfo;
      await dataSources.userDataSource.updateUserAddTagNumber({
        uid,
        action: 'increment',
      });
      // event: added
      await dataSources.tagDataSource.triggerEvent('added', tag);

      // Record user activity after the above function successfully return with
      // no errors.
      await dataSources.tagDataSource.recordUserActivity(
        'addTag',
        userInfo,
        tag.id
      );
      return { tag, imageUploadNumber, imageUploadUrls };
    },
    /**
     *
     * @param {*} _
     * @param {{tagId: string, data: UpdateTagDataInput}} param
     * @param {ResolverArgsInfo} info
     */
    updateTagData: async (_, { tagId, data }, { dataSources, userInfo }) => {
      const { imageDeleteUrls, imageUploadNumber = 0 } = data;
      const { tag } = await dataSources.tagDataSource.updateTagData({
        tagId,
        data,
        userInfo,
      });
      // event: updated
      await dataSources.tagDataSource.triggerEvent('updated', tag);

      // Record user activity after the above function successfully return with
      // no errors.
      await dataSources.tagDataSource.recordUserActivity(
        'updateTag',
        userInfo,
        tagId
      );

      return {
        tag,
        imageUploadNumber,
        imageUploadUrls: await dataSources.storageDataSource.getImageUploadUrls(
          { imageUploadNumber, tagId }
        ),
        imageDeleteStatus: await dataSources.storageDataSource.doImageDelete(
          tagId,
          imageDeleteUrls
        ),
      };
    },
    /**
     *
     * @param {*} _
     * @param {{tagId: string, statusName: string, description: string, hasNumberOfUpVote: string}} param
     * @param {ResolverArgsInfo} info
     * @returns
     */
    updateTagStatus: async (
      _,
      { tagId, statusName, description, hasNumberOfUpVote = false },
      { dataSources, userInfo }
    ) => {
      const updatedStatus = dataSources.tagDataSource.updateTagStatus({
        tagId,
        statusName,
        description,
        userInfo,
        hasNumberOfUpVote,
      });
      // event: updated
      const tag = dataSources.tagDataSource.getTagData({ tagId });
      await dataSources.tagDataSource.triggerEvent('updated', tag);

      // Record user activity after the above function successfully return with
      // no errors.
      await dataSources.tagDataSource.recordUserActivity(
        'updateStatus',
        userInfo,
        tagId
      );

      return updatedStatus;
    },
    /**
     *
     * @param {*} _
     * @param {{tagId: string, action: string}} param
     * @param {ResolverArgsInfo} info
     */
    updateUpVoteStatus: async (
      _,
      { tagId, action },
      { dataSources, userInfo }
    ) => {
      const data = await dataSources.tagDataSource.updateNumberOfUpVote({
        tagId,
        action,
        userInfo,
      });

      // Record user activity after the above function successfully return with
      // no errors.
      await dataSources.tagDataSource.recordUserActivity(
        action,
        userInfo,
        tagId
      );
      return data;
    },

    /**
     *
     * @param {*} _
     * @param {{tagId: string}} param
     * @param {ResolverArgsInfo} info
     * @returns
     */
    deleteTagDataByCreateUser: async (
      _,
      { tagId },
      { dataSources, userInfo }
    ) =>
      dataSources.tagDataSource.deleteTagDataByCreateUser({ tagId, userInfo }),
    /**
     *
     * @param {*} _
     * @param {*} __
     * @param {ResolverArgsInfo} info
     */
    setHasReadGuide: async (_, __, { dataSources, userInfo }) =>
      dataSources.userDataSource.setHasReadGuide({ userInfo }),
    /**
     * @param {*} _
     * @param {{tagId: string}} string
     * @param {ResolverArgsInfo} info
     */
    incrementViewCount: async (_, { tagId }, { dataSources, userInfo }) => {
      const data = await dataSources.tagDataSource.incrementTagViewCount(
        tagId,
        userInfo
      );

      // Record user activity after the above function successfully return with
      // no errors.
      await dataSources.tagDataSource.recordUserActivity(
        'viewTag',
        userInfo,
        tagId
      );

      return data;
    },
  },
};

const subscriptionResolvers = {
  Subscription: {
    archivedThreshold: {
      subscribe: (_, __, { pubsub }) =>
        pubsub.asyncIterator(['archivedThreshold_change']),
    },
    tagChangeSubscription: {
      /**
       * Subscribe to the events occured after the unix timestamp (millseconds)
       * @param {*} _
       * @param {*} __
       * @param {{pubsub: PubSub}}
       * @returns
       */
      subscribe: (_, __, { pubsub }) =>
        pubsub.asyncIterator(['tagChangeSubscription']),
    },
  },
};

const resolvers = {
  ...queryResolvers,
  ...mutationResolvers,
  ...subscriptionResolvers,
  ...tagResolvers,
  ...statusResolvers,
  ...userResolvers,
  ...coordinateResolvers,
  ...pageResolvers,
};

module.exports = resolvers;
